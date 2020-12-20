let updateInterval = 1000
const tracked = new Map()

let state = resetState()

function currentTime(domain) {
    const trackedTime = tracked.get(domain) || 0
    const untrackedTime = (new Date() - state.oldTime) || 0
    return trackedTime + untrackedTime
}

function resetState() {
    return {
        id: 0,
        windowActive: true,
        notIdle: true,
        currentDomain: null,
        oldTime: null
    }
}

function updateTrackingData(domain, newTime) {
    domain && tracked.set(domain,
        (newTime - state.oldTime) + (tracked.get(domain) || 0)
    )
    domain && console.log(tracked);
}

function update(url) {
    const domain = (new URL(url)).hostname || "nonsite"
    console.log("state id: " + state.id);
    const newTime = new Date()
    
    switch (state.id) {
        case 0: // initial state
            state.currentDomain = domain
            state.oldTime = newTime
            state.id = 1
            break
        case 1: // tracking state
            if (state.currentDomain !== domain) {
                updateTrackingData(state.currentDomain, newTime)
                state.currentDomain = domain
                state.oldTime = newTime
            }
            break
        case 2: // Going idle state
            updateTrackingData(state.currentDomain, newTime)
            state.id = 3
            // intentionally avoid break
        case 3: // idle state
            if (state.windowActive && state.notIdle) {
                state.oldTime = newTime
                state.id = 1
            }
            break
    }
}

setInterval(() => {
    browser.tabs.query({currentWindow: true, active: true})
    .then(tabs => { tabs && update(tabs[0].url) })
}, updateInterval)

browser.windows.onFocusChanged.addListener(windowId => {
    state.windowActive = !(windowId === -1)
    if (!state.windowActive) {
        state.id = 2
    }
})

browser.idle.onStateChanged.addListener(idleState => {
    state.notIdle = idleState === "active"
    if (!state.notIdle) {
        state.id = 2
    }
})

browser.runtime.onMessage.addListener((req, sender, sendRes) => {
    sendRes({
        domain: state.currentDomain,
        time: currentTime(state.currentDomain) / 1000
    })
})

browser.idle.setDetectionInterval(1800)