import { spawn } from 'node:child_process'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HOST = '127.0.0.1'
const START_PORT = 4173
const MAX_PORT = 4190
const SERVER_START_TIMEOUT_MS = 30_000
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function canListen(host, port) {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', () => resolve(false))
    server.listen(port, host, () => {
      server.close(() => resolve(true))
    })
  })
}

async function findAvailablePort() {
  for (let port = START_PORT; port <= MAX_PORT; port += 1) {
    if (await canListen(HOST, port)) {
      return port
    }
  }

  throw new Error(`未找到可用端口，已检查 ${START_PORT}-${MAX_PORT}`)
}

function waitForServer(url, child) {
  return new Promise((resolve, reject) => {
    let settled = false
    let retryTimer = null

    const finish = (callback) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutTimer)
      if (retryTimer) clearTimeout(retryTimer)
      child.off('exit', onExit)
      callback()
    }

    const onExit = (code, signal) => {
      finish(() =>
        reject(new Error(`开发服务器提前退出，code=${code ?? 'null'} signal=${signal ?? 'null'}`)),
      )
    }

    child.once('exit', onExit)

    const timeoutTimer = setTimeout(() => {
      if (!child.killed) child.kill()
      finish(() => reject(new Error('开发服务器启动超时，请检查终端中的 Vite 输出。')))
    }, SERVER_START_TIMEOUT_MS)

    const retry = () => {
      if (settled || retryTimer) return
      retryTimer = setTimeout(() => {
        retryTimer = null
        tryRequest()
      }, 400)
    }

    const tryRequest = () => {
      const req = http.get(url, (res) => {
        res.resume()
        if (res.statusCode && res.statusCode < 500) {
          finish(resolve)
          return
        }

        retry()
      })

      req.on('error', retry)

      req.setTimeout(1000, () => {
        req.destroy()
      })
    }

    tryRequest()
  })
}

function openBrowser(url) {
  if (process.platform === 'darwin') {
    return spawn('open', [url], { stdio: 'ignore', detached: true }).unref()
  }

  if (process.platform === 'win32') {
    return spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref()
  }

  return spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref()
}

async function main() {
  const port = await findAvailablePort()
  const url = `http://${HOST}:${port}/`
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const args = ['run', 'dev', '--', '--host', HOST, '--port', String(port), '--strictPort']

  if (port !== START_PORT) {
    console.log(`端口 ${START_PORT} 已被占用，改用 ${port}。`)
  }

  console.log(`正在启动 Flowish：${url}`)

  const child = spawn(npmCommand, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  })

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  process.on('SIGINT', forwardSignal)
  process.on('SIGTERM', forwardSignal)

  await waitForServer(url, child)
  openBrowser(url)
  console.log(`已打开 ${url}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
