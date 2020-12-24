const time = document.getElementById("time")
const domain = document.getElementById("domain")
const timetable = document.getElementById("timetable")

let currentTime = null
let currentDomain = null
let currentTableEntry = null

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
    return browser.runtime.sendMessage({request: "activeTab"})
    .then(resp => {
        domain.innerHTML = resp.domain
        currentTime = resp.time
        time.innerHTML = ms2HoursMinutes(resp.time)
        currentDomain = resp.domain
        return true
    })
}

function newRow(domain, time) {
    const row = document.createElement("tr")
    const domaincell = document.createElement("td")
    const timecell = document.createElement("td")
    domaincell.innerHTML = domain
    timecell.innerHTML = time
    row.append(domaincell)
    row.append(timecell)
    timetable.appendChild(row)
    return timecell
}

function getToday() {
    return browser.runtime.sendMessage({request: "today"})
    .then(resp => {
        const timearray = resp.today || []

        console.log(timearray);

        timearray.sort((a, b) => b.seconds - a.seconds)
        
        timearray.forEach(d => {
            if (d.domain !== currentDomain) {
                newRow(d.domain, ms2HoursMinutes(d.seconds * 1000))
            } else {
                currentTableEntry = newRow(currentDomain, ms2HoursMinutes(currentTime))
            }
        })
    })
}

refreshTime().then(() => {
    getToday().then(() => {
        setInterval(() => {
            currentTime += 1000
            time.innerHTML = ms2HoursMinutes(currentTime)
            if (currentTableEntry) {
                currentTableEntry.innerHTML = time.innerHTML
            }
        }, 1000)
    })
})
