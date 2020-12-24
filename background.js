class Timer {
    constructor() {
        this.updateInterval = 1000
	    this.saveInterval = 10000
        this.timedata = new Map()
        this.state = {}
    }

    load() {
        return browser.storage.local.get(null).then(data => {
            if (data.timearray && this.state.today === data.date) {
                this.timedata = data.timearray.reduce((mem, row) => {
                    mem.set(row.domain, row.seconds * 1000)
                    return mem
                }, new Map())
                console.log("Loaded previous time data.");
            }
            
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
            today: (new Date()).toLocaleDateString()
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

    save() {
        if (this.state.today !== this.state.timestamp.toLocaleDateString()) {
            this.timedata = new Map()
            this.state.today = this.state.timestamp.toLocaleDateString()
        }

        const timearray = []

        this.timedata.forEach((ms, domain) => {
            timearray.push({seconds: Math.floor(ms / 1000), domain})
        })

        return browser.storage.local.set({
            timearray,
            date: this.state.today
        })
    }

    halt() {
        this.stopTimer()
        clearInterval(this.state.updateIntervalId)
        clearInterval(this.state.saveIntervalId)
        console.log("Timer halted");
    }

    onIdle() {
        this.stopTimer()
        this.state.idle = true
        console.log("In idle mode");
    }

    onActive() {
        getActiveDomain().then(domain => {
            this.state.currentDomain = domain
            this.state.idle = false
            this.startTimer()
        })
        console.log("In active mode");
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
    timer.state.browserActive = idleState === "active"
    if (!timer.state.windowActive) {
        timer.onIdle()
    } else if (timer.state.idle && timer.state.windowActive) {
        timer.onActive()
    }
})

browser.runtime.onMessage.addListener((req, sender, sendRes) => {
    sendRes({
        domain: timer.state.currentDomain,
        time: timer.currentTime()
    })
})

browser.idle.setDetectionInterval(1800)
