(async() => {

const { log } = console
const axios = require('axios')
const { appendFileSync, readFileSync } = require('fs')

const verses = readFileSync('tvs.txt', 'utf8').split('\n').filter(Boolean)
const verse = async ref => (await axios.get(`https://bible-api.com/${ref}?translation=nkjv`))?.data?.text?.replace(/\n/g, ' ')?.trim()

await Promise.all(verses.map(async (ref, i) => {
    try {
        setTimeout(async () => {
            log('Downloading', ref, '...')
            let text = await verse(ref)
            appendFileSync('verses.nkjv.txt', `${ref}  ${text}\n`, 'utf8')
        }, i * 1000)
    } catch (e) {
        log('Error: ', e.message)
    }
}))

})()