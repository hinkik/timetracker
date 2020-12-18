let activeTab = null
let firefoxActive = true
let currentDomain = null
const tracked = new Map()

function handleUpdate(url) {
    const domain = (new URL(url)).hostname
    if (domain !== currentDomain) {
        console.log("Hello, you just updated tab: " + domain);
        currentDomain = domain
    }
}

browser.tabs.onActivated.addListener(tab => {
    activeTab = tab.tabId
    browser.tabs.get(tab.tabId).then(tabInfo => {
        handleUpdate(tabInfo.url)
    })
})

browser.tabs.onUpdated.addListener(
    (tabId, changeInfo, tabInfo) => {
    changeInfo.status === "complete" &&
    activeTab === tabId && handleUpdate(tabInfo.url)
})

browser.windows.onFocusChanged.addListener(windowId => {
    firefoxActive = !(windowId === -1)
})

// Need to set activeTab on startup
// Handle window changes