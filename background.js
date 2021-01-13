class Timer {
    constructor() {
        this.updateInterval = 1000 // in milliseconds
        this.saveInterval = 60000 // in milliseconds
        this.siteconfigs = new Map()
        this.timedata = new Map()
        this.state = {}
    }

    updateSettings(settings) {
        console.log("Updated settings");
        this.updateInterval = settings.updateInterval || 5000
        this.saveInterval = settings.updateInterval || 60000
        browser.idle.setDetectionInterval(settings.time2Idle || 300) // in seconds
    }

    load() {
        return browser.storage.local.get([
            "timearray", "date", "settings", "siteconfigsarray"
        ]).then(data => {
            if (data.timearray && data.timearray.length > 0) {
                const timedata = data.timearray.reduce((mem, row) => {
                    const ms = row.seconds * 1000
                    mem.set(row.domain, ms)
                    this.state.timeSpentToday += ms
                    return mem
                }, new Map())

                if (this.state.today === data.date) {
                    console.log("Loaded previous time data from today.");
                    this.timedata = timedata
                } else {
                    this.archive(data.timearray, data.date)
                }
            }

            data.settings && this.updateSettings(data.settings)
            this.siteconfigs = (data.siteconfigsarray || []).reduce((mem, site) => {
                mem.set(site.domain, {...site.settings})
                return mem
            }, new Map())
        })
    }

    init() {
        this.state = {
            currentDomain: null,
            timestamp: null,
            updateIntervalId: null,
            saveIntervalId: null,
            windowActive: true,
            browserActive: true,
            idle: false,
            today: (new Date()).toLocaleDateString(),
            timeSpentToday: 0
        }

        this.load().then(res => {
            getActiveDomain().then(domain => {
                this.state.currentDomain = domain
                this.startTimer()
                this.state.updateIntervalId = setInterval(() => {
                    getActiveDomain().then(domain => this.update(domain))
                }, this.updateInterval)
                this.state.saveIntervalId = setInterval(() => {
                    this.state.idle || this.save()
                }, this.saveInterval)
                console.log("Timer initialized. Domain: " + domain);
            })
        })
    }

    getArchive() {
        return browser.storage.local.get("archive").then(data => {
            const archive = (data.archive || []).push({
                timearray: timemap2timearray(this.timedata),
                date: this.state.today
            })
            return archive
        })
    }

    archive(timearray, date) {
        return browser.storage.local.get("archive").then(data => {
            const archive = data.archive || []
            if (archive.length > 0 && archive[archive.length - 1].date === this.state.today) {
                return
            }
            archive.push({
                timearray,
                date
            })
            console.log("Archived data.");
            return browser.storage.local.set({
                archive
            })
        })
    }

    save() {
        if (this.state.today === this.state.timestamp.toLocaleDateString()) {
            console.log("Saved time data")
            browser.storage.local.set({
                timearray: timemap2timearray(this.timedata),
                date: this.state.today
            })
        } else {
            console.log("New day! Resetting...");
            this.archive(timemap2timearray(this.timedata), this.state.today)
            this.state.today = this.state.timestamp.toLocaleDateString()
            this.timedata = new Map()
        }
    }

    onIdle() {
        if (!this.state.idle) {
            this.stopTimer()
            this.state.idle = true
            console.log("In idle mode");
        }
    }

    onActive() {
        if (this.state.idle) {
            getActiveDomain().then(domain => {
                this.state.currentDomain = domain
                this.state.idle = false
                this.startTimer()
            })
            console.log("In active mode");
        }
    }

    update(domain) {
        if (this.state.currentDomain !== domain) {
            this.stopTimer()
            this.startTimer()
            this.state.currentDomain = domain
            console.log("Domain change to: " + domain);
        }
    }

    stopTimer() {
        if (this.state.currentDomain) {
            const acctime = this.timedata.get(this.state.currentDomain) || 0
            const newtime = new Date() - this.state.timestamp
            this.timedata.set(this.state.currentDomain, acctime + newtime)
            this.state.timeSpentToday += newtime
            console.log("Timer stopped: ");
            console.log(this.timedata);
        }
    }

    startTimer() {
        this.state.timestamp = new Date()
        console.log("Timer started. New timestamp.");
    }
}

function timemap2timearray(timedata) {
    const timearray = []

    timedata.forEach((ms, domain) => {
        timearray.push({seconds: Math.floor(ms / 1000), domain})
    })
    return timearray
}

function siteconfigs2siteconfigsarray(siteconfigs) {
    const siteconfigsarray = []

    siteconfigs.forEach((settings, domain) => {
        siteconfigsarray.push({settings, domain})
    })
    return siteconfigsarray
}

function getActiveDomain() {
    return browser.tabs.query({currentWindow: true, active: true})
    .then(tabs => (new URL(tabs[0].url)).hostname || "nonsite")
}

const timer = new Timer()
timer.init()

browser.windows.onFocusChanged.addListener(windowId => {
    timer.state.windowActive = !(windowId === -1)
    if (!timer.state.windowActive) {
        timer.onIdle()
    } else if (timer.state.idle && timer.state.browserActive) {
        timer.onActive()
    }
})

browser.idle.onStateChanged.addListener(idleState => {
    console.log("Browser state changed to : " + idleState);
    timer.state.browserActive = idleState === "active"
    if (
        !timer.state.browserActive &&
        timer.siteconfigs.has(timer.state.currentDomain) &&
        timer.siteconfigs.get(timer.state.currentDomain).idleIgnore
    ) {
        timer.onIdle()
    } else if (timer.state.idle && timer.state.windowActive) {
        timer.onActive()
    }
})

browser.runtime.onMessage.addListener((req, sender, sendRes) => {
    if (req.request === "init") {
        const aggtime = timer.timedata.get(timer.state.currentDomain) || 0
        const newtime = (new Date() - timer.state.timestamp) || 0

        sendRes({
            currentDomain: timer.state.currentDomain,
            currentTime: aggtime + newtime,
            timearray: timemap2timearray(timer.timedata),
            siteconfig: timer.siteconfigs.get(timer.state.currentDomain),
            timeSpentToday: timer.state.timeSpentToday + newtime
        })
    } else if (req.request === "updateSiteConfigs") {
        timer.siteconfigs.set(req.currentDomain, req.settings)
        browser.storage.local.set({
            siteconfigsarray: siteconfigs2siteconfigsarray(timer.siteconfigs)
        })
    }
})

browser.idle.setDetectionInterval(300) // in seconds
