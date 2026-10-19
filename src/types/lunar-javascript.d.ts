declare module 'lunar-javascript' {
  export const Solar: {
    fromYmd: (year: number, month: number, day: number) => {
      getLunar: () => {
        getJieQi: () => { getName: () => string } | string | null
        getFestivals: () => string[]
      }
    }
  }

  export const HolidayUtil: {
    getHoliday: (
      yearOrDate: number | string,
      month?: number,
      day?: number,
    ) => {
      getName: () => string
      getTarget: () => string
      isWork: () => boolean
    } | null
  }
}
