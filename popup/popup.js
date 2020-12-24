const time = document.getElementById("time")
const domain = document.getElementById("domain")

function ms2HoursMinutes(ms) {
    const seconds = ms / 1000
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const s = String(Math.floor(seconds) % 60)
    const m = String(Math.floor(minutes) % 60)
    const h = String(Math.floor(hours))
    const f = (n) => n.length > 1 ? n : "0" + n
    return f(String(h)) + ":" + f(String(m)) + ":" + f(String(s))
}

function refreshTime() {
    return browser.runtime.sendMessage({})
    .then(resp => {
        time.innerHTML = ms2HoursMinutes(resp.time)
        domain.innerHTML = resp.domain
    })
}

refreshTime().then(() => {
    setInterval(() => {
        refreshTime()
    }, 1000)
})
