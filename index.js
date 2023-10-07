const { log } = console
const chalk = require('chalk')
const { stringify, parse } = JSON
const { stdin, stdout } = process
const { createInterface } = require('readline')		
const { readFileSync, copyFileSync, writeFileSync, existsSync } = require('fs')

// Verses
const loadVerses = () => {
	if (!existsSync('./verses.txt')) {
		copyFileSync('./verses.master.txt', './verses.txt')
	}	

	const text = readFileSync('./verses.txt','utf8')
	return text.split('\n').filter(Boolean)
}

const saveVerses = verses => {
	writeFileSync('./verses.txt', verses.join('\n'), 'utf8')
}

const getVerseTotals = () => {
	let available = readFileSync('verses.master.txt', 'utf8').split('\n').filter(Boolean).length
	let remaining = readFileSync('verses.txt', 'utf8').split('\n').filter(Boolean).length
	let learned = available - remaining 
	return { learned, available }
}

const nextVerse = () => {
	const verse = verses.shift()
	return verse
}

const removeVerse = ref => {
	verses = verses.filter(v => !new RegExp(`^${ref} `).test(v))
	saveVerses(verses)	
	saveBuckets()
}

let verses = loadVerses()


// Buckets
const loadBuckets = () => {
	if (!existsSync('./buckets.json')) {
		copyFileSync('./buckets.master.json', './buckets.json')
	}

	const json = readFileSync('./buckets.json', 'utf8')
	return parse(json)
}

const saveBuckets = () => {
	let json = stringify(buckets, null, 4)
	writeFileSync('./buckets.json', json, 'utf8')
	buckets = loadBuckets()
}


// Input
const compare = (a, b) => {
	if (!a || !b) return false
	const A = a.toString().toUpperCase().trim() 
	const B = b.toString().toUpperCase().trim()
	return A === B
}

const parseVerse = line => {
	let text = line.replace(/^([\w\d ]+? \d+:\d+) (.*)$/, '$2').trim()
	let ref = line.replace(/^([\w\d ]+? \d+:\d+) (.*)$/, '$1').trim()
	return { ref, text }
}

const parseRef = ref => {
	let book = ref.replace(/^([\w\d ]+?) (\d+):(\d+)$/, '$1').trim()
	let chapter = ref.replace(/^([\w\d ]+?) (\d+):(\d+)$/, '$2').trim()
	let verse = ref.replace(/^([\w\d ]+?) (\d+):(\d+)$/, '$3').trim()
	return { book, chapter, verse }		
}

const prompt = async (ref, text, initial) => {
	return new Promise((res, rej) => {
		try {
			const repl = createInterface(stdin, stdout)
			repl.setPrompt(chalk.dim.cyan(''))

			repl.on('line', line => {
				let { text: input, ref: inref } = parseVerse(line)
			
				if (compare(inref, ref) && compare(input, text)) {
					repl.close()
					return res(input)
				} else if (input) {
					let words = text.split(' ')

					log(chalk`{bold {red Sorry that is not correct, please try again!}\n}
${initial ? chalk`{green ${ref}} {green ${text}}` : ''}
${(inref !== ref ? chalk.red : chalk.green)(inref)} ${input.split(' ').map((w, i) => (compare(w, words[i]) ? chalk.green : chalk.red.bold)(w)).join(' ')}
					`)
				}
				repl.prompt()
			})

			repl.prompt()
		} catch (e) {
			rej(e)
		}
	})
}

const typeColors = { daily: 'bgBlue', oddEven: 'bgMagenta', dayOfWeek: 'bgYellow', dateOfMonth: 'bgCyan' }

// Reviews
const reviewVerse = async (verse, type, initial) => {
	if (!verse) return 
	const [ref, text] = verse.split('  ')

	return new Promise(res => setTimeout(async () => {
		console.clear()
		let title = `${type} Review for ${ref}`

		if (initial) {
			log(chalk[typeColors[type]]`{bold {black ${' '.repeat((80 - title.length)/2)}${title}${' '.repeat((80 - title.length)/2)}}}`)
			log(chalk`{blue Learn the verse by typing it out and saying each word including punctuation:}\n`)
			log(chalk`{dim {cyan ${ref}}} {white {bold ${text}}}`)
			await prompt(ref, text, initial)
			console.clear()
		}

		log(chalk[typeColors[type]]`{bold {black ${' '.repeat((80 - title.length)/2)}${title}${' '.repeat((80 - title.length)/2)}}}`)
		log(chalk`{yellow Complete the missing words in the verse from memory:}\n`)
		let { ref: fullref } = parseVerse(verse)
		let { book, chapter, verse: vrs } = parseRef(fullref)
		let reftext = (initial || new Date().getDay() % 2 == 0 ? chalk.cyan : chalk.bgCyan.cyan)(book)
		let numtext = [chapter, vrs].map(n => ((n.length > 1 || +n > 5) ? chalk.bgCyan.cyan.bold : chalk.cyan.bold)(n)).join(':') 
		let wordlen = initial ? 3 : new Date().getDay() % 2 === 0 ? 0 : 3
		let masktext = w => chalk`{bold {white ${w[0]}}}{bold {bgGray ${w.slice(1).replace(/(\W)/g, chalk.white('$1'))}}}`
		let versetext = text.split(' ').map(w => w.length <= wordlen ? chalk.white(w) : masktext(w)).join(' ')
		log(chalk`{dim ${reftext} ${numtext}} {gray ${versetext}}`)

		await prompt(ref, text)
		removeVerse(ref)
		console.clear()
		return res(true)
	}, 3000))
}

const reviewOldest = async (bucket, verse, type, initial) => {
	const oldestVerse = bucket.shift()

	if (verse) {
		bucket.push(verse)
	}

	await reviewVerse(oldestVerse, type, initial)
	return oldestVerse
}

const reviewAll = async (bucket, verse) => {
	if (verse) bucket.push(verse)
	let oldBucket = [...new Set(bucket)].filter(Boolean)
	await Promise.all(oldBucket.map(async v => await reviewVerse(v, 'dateOfMonth')))
	return bucket
}

const review = async (type, index, verse) => {
	let bucket = buckets[type]
		
	if (bucket && index && bucket[index]) {
		bucket = bucket[index]
	} else if (index) {
		throw chalk.red(`Bucket ${type}[${index}] not found`)
	}

	if (bucket.length) {
		log(chalk.blue.dim(`Loading ${bucket.length} verse(s) for ${type} review...`.trim()))
	}

	let reviewer = type === 'dateOfMonth' ? reviewAll : reviewOldest
	let oldestVerse = await reviewer(bucket, verse, type, type === 'daily')
	return oldestVerse 
}

const reviewDaily = async buckets => {
	const dailyVerse = nextVerse()	
	buckets.daily.push(dailyVerse)
	return await review('daily')
}

const reviewOddEven = async verse => {
	const dayNum = new Date().getDate()
	const isEven = dayNum % 2 == 0
	const type = isEven ? 'even' : 'odd'
	return await review('oddEven', type, verse)
}

const reviewWeekday = async verse => {
	const weekDayNum = new Date().getDay()
	return await review('dayOfWeek', weekDayNum, verse)
}

const reviewMonthDate = async verse => {
	const dateOfMonth = new Date().getDate()
	return await review('dateOfMonth', dateOfMonth, verse)
}

const reviewBuckets = async () => {
	console.clear()
	let title = 'RE-VERSE SCRIPTURE MEMORY SYSTEM'.split('').join(' ') 

	log(chalk`{bgBlue                                                                                   }`)
	log(chalk`{bgBlue {bold ${' '.repeat((80 - title.length)/2)}${chalk.bold.black(title)}${' '.repeat((80 - title.length)/2)}   }}`)
	// log(chalk`{bgBlue {bold                          RE-VERSE SCRIPTURE MEMORY SYSTEM                         }}`)
	log(chalk`{bgBlue                                                                                   }\n\n`)

	let totals = getVerseTotals()

	log(chalk`{blue {bold {green ${totals.learned}}} verse(s) out of {bold {blue ${totals.available}}} total verse(s) learned!}`)
	log(chalk`{dim {bgGray ${' '.repeat(Math.round(totals.available / 85))}}${chalk`\r{bold {bgGreen ${' '.repeat(Math.round((totals.learned * 10) / 85))}}}`}}\n\n`)

	log(chalk`{bgBlue {bold {black                                 REVIEW FOR TODAY                                  }}}`)
	buckets = loadBuckets()
	log(chalk`
  {blue {bold ${buckets.daily.length + 1}} daily verse(s)}
  {magenta {bold ${buckets.oddEven[new Date().getDate() % 2 == 0 ? 'even' : 'odd'].length}} odd/even verse(s)}
  {yellow {bold ${buckets.dayOfWeek[new Date().getDay()].length}} weekday verse(s)}
  {cyan {bold ${buckets.dateOfMonth[new Date().getDate()].length}} date of month verse(s)}
	
`)
	
	const dailyVerse = await reviewDaily(buckets)
	const oddEvenVerse = await reviewOddEven(dailyVerse)
	const weekDayVerse = await reviewWeekday(oddEvenVerse)
	const monthDateVerse = await reviewMonthDate(weekDayVerse)
	saveBuckets()
	log(chalk`{bold {green Review completed! Progress saved!}}`)
}


// Main
(async() => await reviewBuckets())()