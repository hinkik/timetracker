const btn = document.getElementById("btn")
const label = document.getElementById("info")
browser.runtime.sendMessage({greeting: "Howdy"})
.then(resp => {
    label.innerHTML = resp.domain + " " + resp.time
})