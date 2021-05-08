var player;
var needCanvasUpdate = true;
var gameEnded = false;
var scrolled = false;

// Don't change this
const TMT_VERSION = {
	tmtNum: "2.5.2.1",
	tmtName: "Dreams Really Do Come True"
}



function getResetGain(layer, canMax=false, useType = null) {
	let type = useType
	if (!useType){ 
		type = tmp[layer].type
		if (layers[layer].getResetGain !== undefined)
			return layers[layer].getResetGain()
	} 
	if(tmp[layer].type == "none")
		return new Decimal (0)
	if (tmp[layer].gainExp.eq(0)) return new Decimal(0)
	if (type=="static") {
		let base = new Decimal(1e8)
		let exp = new Decimal(1.9)
		if ((!tmp[layer].canBuyMax) || tmp[layer].baseAmount.lt(tmp[layer].requires)) return new Decimal(1)
		let gain = tmp[layer].baseAmount.div(tmp[layer].requires).div(tmp[layer].gainMult).max(1).log(tmp[layer].base).times(tmp[layer].gainExp).pow(Decimal.pow(tmp[layer].exponent, -1))
		if (layer == "r"  || layer == "u" || layer == "e") gain = softcapStaticGain(gain, tmp[layer].row)
		if (layer=="e") gain = gain.mul(tmp.e.infDiv)
		if (layer == "u" && player.u.points.lt(320)) {
			let amt = player[layer].points.plus((canMax&&tmp[layer].baseAmount.gte(tmp[layer].nextAt))?tmp[layer].resetGain:0)
			if (player.u.points.gte(30)) {
				let umult = Decimal.pow(1e8,amt.pow(1.9))
				gain = tmp[layer].baseAmount.div(umult).div(tmp[layer].requires).div(tmp[layer].gainMult).max(1).log(tmp[layer].base).times(tmp[layer].gainExp).pow(Decimal.pow(tmp[layer].exponent, -1)).add(30)
				gain = softcapStaticGain(gain, tmp[layer].row)
			}
			if (player.u.points.lt(30)) { 
				gain = Decimal.div(tmp["u"].baseAmount,tmp[layer].requires).div(tmp[layer].gainMult).max(1).log(base).times(tmp[layer].gainExp).pow(Decimal.pow(exp, -1))
				if (gain.gte(30)) { 
					let umult = Decimal.pow(1e8,amt.pow(1.9))
					gain = tmp[layer].baseAmount.div(umult).div(tmp[layer].requires).div(tmp[layer].gainMult).max(1).log(tmp[layer].base).times(tmp[layer].gainExp).pow(Decimal.pow(tmp[layer].exponent, -1)).add(30)
					gain = softcapStaticGain(gain, tmp[layer].row)
					
				}
			}
		}
		if (layer == "u" && gain.gte(1e34)) gain = gain.div(1e34).pow(0.2).mul(1e34)
		if (layer == "s") {
			if (gain.gte(getDUpgEff(41).add(20))) {  // gain=1e10000^1.9^s
				gain = tmp[layer].baseAmount.div(tmp[layer].requires).log(Decimal.pow(10,1e4)).log(1.9).add(getDUpgEff(41).add(20))
			}
			if (player.s.points.lt(getDUpgEff(41).add(20))) { 
				gain = tmp[layer].baseAmount.div(tmp[layer].requires).div(tmp[layer].gainMult).max(1).log(tmp[layer].base).times(tmp[layer].gainExp).pow(Decimal.pow(tmp[layer].exponent, -1))
				if (gain.gte(getDUpgEff(41).add(20))) {  // gain=1e10000^1.9^s
					gain = tmp[layer].baseAmount.div(tmp[layer].requires).log(Decimal.pow(10,1e4)).log(1.9).add(getDUpgEff(41).add(20))
				}
			}
		}
		let resetgain = gain.floor().sub(player[layer].points).add(1).max(1)
		if (player.u.points.gte(30) && layer == "u") resetgain = gain.floor().sub(player[layer].points).add(1).max(1)
		return resetgain;
	} else if (type=="normal"){
		if (tmp[layer].baseAmount.lt(tmp[layer].requires)) return new Decimal(0)
		let gain = tmp[layer].baseAmount.div(tmp[layer].requires).pow(tmp[layer].exponent).times(tmp[layer].gainMult).pow(tmp[layer].gainExp)
		if (gain.gte(tmp[layer].softcap)) gain = gain.pow(tmp[layer].softcapPower).times(tmp[layer].softcap.pow(decimalOne.sub(tmp[layer].softcapPower)))
		return gain.floor().max(0);
	} else if (type=="custom"){
		return layers[layer].getResetGain()
	} else {
		return new Decimal(0)
	}
}

function getNextAt(layer, canMax=false, useType = null) {
	let type = useType
	if (!useType) {
		type = tmp[layer].type
		if (layers[layer].getNextAt !== undefined)
			return layers[layer].getNextAt(canMax)

		}
	if(tmp[layer].type == "none")
		return new Decimal (Infinity)

	if (tmp[layer].gainMult.lte(0)) return new Decimal(Infinity)
	if (tmp[layer].gainExp.lte(0)) return new Decimal(Infinity)

	if (type=="static") 
	{
		if (!tmp[layer].canBuyMax) canMax = false
		let base = new Decimal(1e8)
		let exp = new Decimal(1.9)
		let amt = player[layer].points.plus((canMax&&tmp[layer].baseAmount.gte(tmp[layer].nextAt))?tmp[layer].resetGain:0)
		let g = amt
		if (layer == "e") g = g.div(tmp.e.infDiv)
		if (layer == "r" || layer == "u" || layer == "e") amt = scaleStaticCost(g, tmp[layer].row)
		let extraCost = Decimal.pow(tmp[layer].base, amt.pow(tmp[layer].exponent).div(tmp[layer].gainExp)).times(tmp[layer].gainMult)
		let cost = extraCost.times(tmp[layer].requires).max(tmp[layer].requires)
		if (layer == "u") {
			if (player.u.points.gte(30)) {
				amt = amt.sub(30)
				let umult = Decimal.pow(1e8,(amt.add(30)).pow(1.9))
				extraCost = Decimal.pow(tmp[layer].base, amt.pow(tmp[layer].exponent).div(tmp[layer].gainExp)).times(tmp[layer].gainMult).mul(umult)
				cost = extraCost.times(tmp[layer].requires).max(tmp[layer].requires)
			}
			if (player.u.points.lt(30)) { 
				amt = player[layer].points.plus((canMax&&tmp[layer].baseAmount.gte(tmp[layer].nextAt))?tmp[layer].resetGain:0)
				extraCost = Decimal.pow(base, amt.pow(exp).div(tmp[layer].gainExp)).times(tmp[layer].gainMult)
				if (amt.gte(30)) { 
					let umult = Decimal.pow(1e8,amt.pow(1.9))
					extraCost = Decimal.pow(tmp[layer].base, (amt.sub(30)).pow(tmp[layer].exponent).div(tmp[layer].gainExp)).times(tmp[layer].gainMult).mul(umult)
				}
				cost = extraCost.times(tmp[layer].requires).max(tmp[layer].requires)
			}
		}
		if (layer == "s") {
			if (player.s.points.gte(getDUpgEff(41).add(20))) {
				cost = Decimal.pow(Decimal.pow(10,1e4),Decimal.pow(1.9,amt.sub(getDUpgEff(41).add(20))))
			}
		}
		if (tmp[layer].roundUpCost) cost = cost.ceil()
		return cost;
	} else if (type=="normal"){
		let next = tmp[layer].resetGain.add(1)
		if (next.gte(tmp[layer].softcap)) next = next.div(tmp[layer].softcap.pow(decimalOne.sub(tmp[layer].softcapPower))).pow(decimalOne.div(tmp[layer].softcapPower))
		next = next.root(tmp[layer].gainExp).div(tmp[layer].gainMult).root(tmp[layer].exponent).times(tmp[layer].requires).max(tmp[layer].requires)
		if (tmp[layer].roundUpCost) next = next.ceil()
		return next;
	} else if (type=="custom"){
		return layers[layer].getNextAt(canMax)
	} else {
		return new Decimal(0)
	}}

function softcap(value, cap, power = 0.5) {
	if (value.lte(cap)) return value
	else
		return value.pow(power).times(cap.pow(decimalOne.sub(power)))
}

// Return true if the layer should be highlighted. By default checks for upgrades only.
function shouldNotify(layer){
	for (id in tmp[layer].upgrades){
		if (!isNaN(id)){
			if (canAffordUpgrade(layer, id) && !hasUpgrade(layer, id) && tmp[layer].upgrades[id].unlocked){
				return true
			}
		}
	}
	if (player[layer].activeChallenge && canCompleteChallenge(layer, player[layer].activeChallenge)) {
		return true
	}

	if (tmp[layer].shouldNotify)
		return true

	if (isPlainObject(tmp[layer].tabFormat)) {
		for (subtab in tmp[layer].tabFormat){
			if (subtabShouldNotify(layer, 'mainTabs', subtab)) {
				tmp[layer].trueGlowColor = tmp[layer].tabFormat[subtab].glowColor
				return true
			}
		}
	}

	for (family in tmp[layer].microtabs) {
		for (subtab in tmp[layer].microtabs[family]){
			if (subtabShouldNotify(layer, family, subtab)) {
				tmp[layer].trueGlowColor = tmp[layer].microtabs[family][subtab].glowColor
				return true
			}
		}
	}
	 
	return false
	
}

function canReset(layer)
{	
	if (layers[layer].canReset!== undefined)
		return run(layers[layer].canReset, layers[layer])
	else if(tmp[layer].type == "normal")
		return tmp[layer].baseAmount.gte(tmp[layer].requires)
	else if(tmp[layer].type== "static")
		return tmp[layer].baseAmount.gte(tmp[layer].nextAt) 
	else 
		return false
}

function rowReset(row, layer) {
	for (lr in ROW_LAYERS[row]){
		if(layers[lr].doReset) {

			player[lr].activeChallenge = null // Exit challenges on any row reset on an equal or higher row
			run(layers[lr].doReset, layers[lr], layer)
		}
		else
			if(tmp[layer].row > tmp[lr].row && row !== "side" && !isNaN(row)) layerDataReset(lr)
	}
}

function layerDataReset(layer, keep = []) {
	let storedData = {unlocked: player[layer].unlocked, forceTooltip: player[layer].forceTooltip} // Always keep these

	for (thing in keep) {
		if (player[layer][keep[thing]] !== undefined)
			storedData[keep[thing]] = player[layer][keep[thing]]
	}
	Vue.set(player[layer], "buyables", getStartBuyables(layer))
	Vue.set(player[layer], "clickables", getStartClickables(layer))
	Vue.set(player[layer], "challenges", getStartChallenges(layer))

	layOver(player[layer], getStartLayerData(layer))
	player[layer].upgrades = []
	player[layer].milestones = []
	player[layer].achievements = []
	player[layer].challenges = getStartChallenges(layer)
	resetBuyables(layer)

	if (layers[layer].clickables && !player[layer].clickables) 
		player[layer].clickables = getStartClickables(layer)
	for (thing in storedData) {
		player[layer][thing] =storedData[thing]
	}
}

function resetBuyables(layer){
	if (layers[layer].buyables) 
		player[layer].buyables = getStartBuyables(layer)
	player[layer].spentOnBuyables = new Decimal(0)
}


function addPoints(layer, gain) {
	player[layer].points = player[layer].points.add(gain).max(0)
	if (player[layer].best) player[layer].best = player[layer].best.max(player[layer].points)
	if (player[layer].total) player[layer].total = player[layer].total.add(gain)
}

function generatePoints(layer, diff) {
	addPoints(layer, tmp[layer].resetGain.times(diff))
}

var prevOnReset

function doReset(layer, force=false) {
	let row = tmp[layer].row
	if (!force) {
		if (tmp[layer].baseAmount.lt(tmp[layer].requires)) return;
		let gain = tmp[layer].resetGain
		if (tmp[layer].type=="static") {
			if (tmp[layer].baseAmount.lt(tmp[layer].nextAt)) return;
			gain =(tmp[layer].canBuyMax ? gain : 1)
		} 
		if (tmp[layer].type=="custom") {
			if (!tmp[layer].canReset) return;
		} 

		let timesMult = 1

		timesMult = Math.floor(timesMult)
		if (player[layer].times != undefined) player[layer].times += timesMult

		if (layers[layer].onPrestige)
			layers[layer].onPrestige(gain)
		
		addPoints(layer, gain)
		updateMilestones(layer)
		updateAchievements(layer)

		if (!player[layer].unlocked) {
			player[layer].unlocked = true;
			needCanvasUpdate = true;

			if (tmp[layer].increaseUnlockOrder){
				lrs = tmp[layer].increaseUnlockOrder
				for (lr in lrs)
					if (!player[lrs[lr]].unlocked) player[lrs[lr]].unlockOrder++
			}
		}
		tmp[layer].baseAmount = new Decimal(0) // quick fix
	}
	if (tmp[layer].resetsNothing) return

	for (layerResetting in layers) {
		if (row >= layers[layerResetting].row && (!force || layerResetting != layer)) completeChallenge(layerResetting)
	}

	prevOnReset = {...player} //Deep Copy
	player.points = (row == 0 ? new Decimal(0) : getStartPoints())


	for (let x = row; x >= 0; x--) rowReset(x, layer)
	rowReset("side", layer)
	prevOnReset = undefined

	player[layer].resetTime = 0

	updateTemp()
	updateTemp()
	updateTemp()
	updateTemp()
}

function toggleShift() {
	shiftDown = !shiftDown
}

function resetRow(row) {
	if (prompt('Are you sure you want to reset this row? It is highly recommended that you wait until the end of your current run before doing this! Type "I WANT TO RESET THIS" to confirm')!="I WANT TO RESET THIS") return
	let pre_layers = ROW_LAYERS[row-1]
	let layers = ROW_LAYERS[row]
	let post_layers = ROW_LAYERS[row+1]
	rowReset(row+1, post_layers[0])
	doReset(pre_layers[0], true)
	for (let layer in layers) {
		player[layer].unlocked = false
		if (player[layer].unlockOrder) player[layer].unlockOrder = 0
	}
	player.points = getStartPoints()
	updateTemp();
	resizeCanvas();
}

function startChallenge(layer, x) {
	let enter = false
	if (!player[layer].unlocked) return
	if (player[layer].activeChallenge == x) {
		completeChallenge(layer, x)
		player[layer].activeChallenge = null
	} else {
		enter = true
	}	
	doReset(layer, true)
	if(enter) {
		player[layer].activeChallenge = x
		if (layers[layer].challenges[x].onStart) layers[layer].challenges[x].onStart(true);
	}
	updateChallengeTemp(layer)
}

function canCompleteChallenge(layer, x)
{
	if (x != player[layer].activeChallenge) return
	let challenge = tmp[layer].challenges[x]
	if (challenge.canComplete !== undefined) return challenge.canComplete

	if (challenge.currencyInternalName){
		let name = challenge.currencyInternalName
		if (challenge.currencyLocation){
			return !(challenge.currencyLocation[name].lt(challenge.goal)) 
		}
		else if (challenge.currencyLayer){
			let lr = challenge.currencyLayer
			return !(player[lr][name].lt(challenge.goal)) 
		}
		else {
			return !(player[name].lt(challenge.goal))
		}
	}
	else {
		return !(player.points.lt(challenge.goal))
	}

}

function completeChallenge(layer, x) {
	var x = player[layer].activeChallenge
	if (!x) return
	
	let completions = canCompleteChallenge(layer, x)
	if (!completions){
		 player[layer].activeChallenge = null
		return
	}
	if (player[layer].challenges[x] < tmp[layer].challenges[x].completionLimit) {
		needCanvasUpdate = true
		player[layer].challenges[x] += completions
		player[layer].challenges[x] = Math.min(player[layer].challenges[x], tmp[layer].challenges[x].completionLimit)
		if (layers[layer].challenges[x].onComplete) run(layers[layer].challenges[x].onComplete, layers[layer].challenges[x])
	}
	player[layer].activeChallenge = null
	updateChallengeTemp(layer)
}

VERSION.withoutName = "v" + VERSION.num + (VERSION.pre ? " Pre-Release " + VERSION.pre : VERSION.pre ? " Beta " + VERSION.beta : "")
VERSION.withName = VERSION.withoutName + (VERSION.name ? ": " + VERSION.name : "")


function autobuyUpgrades(layer){
	if (!tmp[layer].upgrades) return
	for (id in tmp[layer].upgrades)
		if (isPlainObject(tmp[layer].upgrades[id]) && (layers[layer].upgrades[id].canAfford === undefined || layers[layer].upgrades[id].canAfford() === true))
			buyUpg(layer, id) 
}

function gameLoop(diff) {
	if (isEndgame() || gameEnded) gameEnded = 1

	if (isNaN(diff)) diff = 0
	if (gameEnded && !player.keepGoing) {
		diff = 0
		player.tab = "gameEnded"
	}
	if (player.devSpeed != undefined) diff *= player.devSpeed

	let limit = maxTickLength()
	if (diff > limit) diff = limit
	addTime(diff)
	adjustPopupTime(diff)
	player.points = player.points.add(tmp.pointGen.times(diff)).max(0)
	player.ca = player.points.layer
	player.cases = player.points.layer>3
	if (hasMilestone("u", 2)) generatePoints("i",diff)
	player.infectivity = player.i.points.layer>3
	if (player.hideNews) {
		document.getElementById("newsTicker").style.display = "none";
	}
	document.getElementById("newsbtn").onclick = function() {
		if (!player.hideNews) {
		  document.getElementById("newsTicker").style.display = "none";
		  player.hideNews = true
		} else {
		  document.getElementById("newsTicker").style.display = "block";
		  player.hideNews = false
		}
	  }

	for (let x = 0; x <= maxRow; x++){
		for (item in TREE_LAYERS[x]) {
			let layer = TREE_LAYERS[x][item]
			player[layer].resetTime += diff
			if (tmp[layer].passiveGeneration) generatePoints(layer, diff*tmp[layer].passiveGeneration);
			if (layers[layer].update) layers[layer].update(diff);
		}
	}

	for (row in OTHER_LAYERS){
		for (item in OTHER_LAYERS[row]) {
			let layer = OTHER_LAYERS[row][item]
			player[layer].resetTime += diff
			if (tmp[layer].passiveGeneration) generatePoints(layer, diff*tmp[layer].passiveGeneration);
			if (layers[layer].update) layers[layer].update(diff);
		}
	}	

	for (let x = maxRow; x >= 0; x--){
		for (item in TREE_LAYERS[x]) {
			let layer = TREE_LAYERS[x][item]
			if (tmp[layer].autoPrestige && tmp[layer].canReset) doReset(layer);
			if (layers[layer].automate) layers[layer].automate();
			if (layers[layer].autoUpgrade) autobuyUpgrades(layer)
		}
	}

	for (row in OTHER_LAYERS){
		for (item in OTHER_LAYERS[row]) {
			let layer = OTHER_LAYERS[row][item]
			if (tmp[layer].autoPrestige && tmp[layer].canReset) doReset(layer);
			if (layers[layer].automate) layers[layer].automate();
			player[layer].best = player[layer].best.max(player[layer].points)
			if (layers[layer].autoUpgrade) autobuyUpgrades(layer)
		}
	}

	for (layer in layers){
		if (layers[layer].milestones) updateMilestones(layer);
		if (layers[layer].achievements) updateAchievements(layer)
	}
}

function hardReset() {
	if (!confirm("Are you sure you want to do this? You will lose all your progress!")) return
	player = null
	save();
	window.location.reload();
}

var ticking = false
var devstop = false
var perSecondCount = 0

function doPerSecondStuff(){
	updateHotkeys()
}

var lastTenTicks = []

var interval = setInterval(function() {
	if (player===undefined||tmp===undefined) return;
	if (ticking) return;
	if (gameEnded&&!player.keepGoing) return;
	if (devstop) return
	ticking = true
	let now = Date.now()
	let diff = (now - player.time) / 1e3
	if (player.offTime !== undefined) {
		if (player.offTime.remain > modInfo.offlineLimit * 1000) player.offTime.remain = modInfo.offlineLimit * 1000
		if (player.offTime.remain > 0) {
			let offlineDiff = Math.max(player.offTime.remain / 10, diff)
			player.offTime.remain -= offlineDiff
			diff += offlineDiff
		}
		if (!player.offlineProd || player.offTime.remain <= 0) delete player.offTime
	}
	player.time = now
	if (needCanvasUpdate){ resizeCanvas();
		needCanvasUpdate = false;
	}
	tmp.scrolled = document.getElementById('treeTab') && document.getElementById('treeTab').scrollTop > 30
	updateTemp();
	updateOomps(diff);
	updateWidth()
	gameLoop(diff)
	perSecondCount += diff
	if (perSecondCount > 10) perSecondCount = 10
	if (perSecondCount > 1) {
		perSecondCount += -1
		doPerSecondStuff()
	}
	lastTenTicks.push(Date.now()-now)
	if (lastTenTicks.length > 10) lastTenTicks = lastTenTicks.slice(1,)
	ticking = false
}, 50)