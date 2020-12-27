class Timer {
    constructor() {
        this.updateInterval = 1000 // in milliseconds
        this.saveInterval = 60000 // in milliseconds
        this.siteconfigs = new Map()
        this.timedata = new Map()
        this.state = {}
        this.archive = []
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
            if (data.timearray && this.state.today === data.date) {
                this.timedata = data.timearray.reduce((mem, row) => {
                    const ms = row.seconds * 1000
                    mem.set(row.domain, ms)
                    this.state.timeSpentToday += ms
                    return mem
                }, new Map())
                console.log("Loaded previous time data.");
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
                    this.state.idle || this.save().then(res => console.log("Saved time data"))
                    .catch(err => console.log(err))
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

    save() {
        const timearray = timemap2timearray(this.timedata)

        if (this.state.today === this.state.timestamp.toLocaleDateString()) {
            return browser.storage.local.set({
                timearray,
                date: this.state.today
            })
        } else {
            return browser.storage.local.get("archive").then(data => {
                const archive = data.archive || []
                archive.push({
                    timearray,
                    date: this.state.today
                })
                this.state.today = this.state.timestamp.toLocaleDateString()
                this.timedata = new Map()
                return browser.storage.local.set({
                    archive
                })
            })
        }
    }

    halt() {
        this.stopTimer()
        clearInterval(this.state.updateIntervalId)
        clearInterval(this.state.saveIntervalId)
        console.log("Timer halted");
    }

    onIdle() {
        if (this.siteconfigs.has(this.state.currentDomain) &&
            this.siteconfigs.get(this.state.currentDomain).idleIgnore
        ) {
            return
        }
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

    currentTime() {
        const aggtime = this.timedata.get(this.state.currentDomain) || 0
        const newtime = (new Date() - this.state.timestamp) || 0
        return aggtime + newtime
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
    if (!timer.state.browserActive) {
        timer.onIdle()
    } else if (timer.state.idle && timer.state.windowActive) {
        timer.onActive()
    }
})

browser.runtime.onMessage.addListener((req, sender, sendRes) => {
    if (req.request === "init") {
        sendRes({
            currentDomain: timer.state.currentDomain,
            currentTime: timer.currentTime(),
            timearray: timemap2timearray(timer.timedata),
            siteconfig: timer.siteconfigs.get(timer.state.currentDomain),
            timeSpentToday: timer.state.timeSpentToday
        })
    } else if (req.request === "updateSiteConfigs") {
        timer.siteconfigs.set(req.currentDomain, req.settings)
        browser.storage.local.set({
            siteconfigsarray: siteconfigs2siteconfigsarray(timer.siteconfigs)
        })
    }
})