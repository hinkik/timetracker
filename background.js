class Timer {
    constructor() {
        this.updateInterval = 1000
        this.timedata = new Map()
        this.state = {
            currentDomain: null,
            timestamp: null,
            intervalId: null,
            windowActive: true,
            browserActive: true,
            idle: false
        }
    }

    init() {
        getActiveDomain().then(domain => {
            this.state.currentDomain = domain
            this.startTimer()
            this.state.intervalId = setInterval(() => {
                getActiveDomain().then(domain => this.updateDomain(domain))
            }, this.updateInterval)
            console.log("Timer initialized. Domain: " + domain);
        })
        
    }

    halt() {
        this.stopTimer()
        clearInterval(this.state.intervalId)
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

    updateDomain(domain) {
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
        time: timer.currentTime() / 1000
    })
})

browser.idle.setDetectionInterval(1800)