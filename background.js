let updateInterval = 2000
const tracked = new Map()

const state = {
    browserActive: true,
    currentDomain: null,
    startTime: null
}

function addTimeTracked(domain, endTime) {
    tracked.set(domain, 
        (endTime - state.startTime) + (tracked.get(domain) || 0)
    )
}

function setActive(isActive) {
    if (state.browserActive !== isActive) {
        if (isActive) {
            console.log("Going active");
            state.startTime = new Date()
        } else {
            console.log("Going idle");
            addTimeTracked(state.currentDomain, new Date())
        }
        state.browserActive = isActive
    }
}

function handleUpdate(url) {
    const domain = (new URL(url)).hostname || "nonsite"
    if (domain === state.currentDomain) {
        return
    }
    const endTime = new Date()

    if (state.currentDomain) {
        addTimeTracked(state.currentDomain, endTime)
    }
    
    state.currentDomain = domain
    console.log("Current tab: " + domain);
    state.startTime = endTime
}

setInterval(() => {
    state.browserActive && browser.tabs.query({currentWindow: true, active: true})
    .then(tabs => { tabs && handleUpdate(tabs[0].url) })
}, updateInterval)

browser.windows.onFocusChanged.addListener(windowId => {
    setActive(!(windowId === -1))
})

browser.idle.onStateChanged.addListener(idleState => {
    setActive(idleState === "active")
})

browser.idle.setDetectionInterval(15)