const time = document.getElementById("time")
const domain = document.getElementById("domain")
const timetable = document.getElementById("timetable")
const idleIgnoreButton = document.getElementById("idleIgnore")

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

function newRow(domain, time) {
    const row = document.createElement("tr")
    const domaincell = document.createElement("td")
    const timecell = document.createElement("td")
    domaincell.innerText = domain
    timecell.innerText = time
    row.append(domaincell)
    row.append(timecell)
    timetable.appendChild(row)
    return timecell
}

function setTimetable(timearray) {
    timearray.sort((a, b) => b.seconds - a.seconds)

    timearray.forEach(d => {
        if (d.domain !== currentDomain) {
            newRow(d.domain, ms2HoursMinutes(d.seconds * 1000))
        } else {
            currentTableEntry = newRow(currentDomain, ms2HoursMinutes(currentTime))
        }
    })
}

browser.runtime.sendMessage({request: "init"}).then(resp => {
    domain.innerText = resp.currentDomain
    currentTime = resp.currentTime
    time.innerText = ms2HoursMinutes(resp.currentTime)
    currentDomain = resp.currentDomain

    setTimetable(resp.timearray || [])
    
    if (resp.siteconfig) {
        idleIgnoreButton.checked = resp.siteconfig.idleIgnore
    }

    return setInterval(() => {
        currentTime += 1000
        time.innerText = ms2HoursMinutes(currentTime)
        if (currentTableEntry) {
            currentTableEntry.innerText = time.innerText
        }
    }, 1000)
})

idleIgnoreButton.addEventListener("change", (e) => {
    browser.runtime.sendMessage({
        request: "updateSiteConfigs",
        currentDomain: currentDomain,
        settings: {
            idleIgnore: e.target.checked
        }
    })
})