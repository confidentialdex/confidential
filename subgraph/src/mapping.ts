import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  ConfidentialTrading,
  PositionOpened,
  PositionClosed,
  PositionLiquidated,
  OrderPlaced,
  OrderCancelled,
  OrderExecuted,
  TWAPSliceExecuted,
  TPSLTriggered,
  CollateralAdded,
  CollateralRemoved,
  PositionIncreased,
  PositionPartialClose
} from "../generated/ConfidentialTrading/ConfidentialTrading"
import {
  Deposit,
  Withdraw
} from "../generated/ConfidentialVault/ConfidentialVault"
import { Position, Order, TradeRecord, VaultDeposit, PairDayData, PairStat, VaultStat, TraderStat } from "../generated/schema"

function getOrCreateTraderStat(trader: Bytes): TraderStat {
  let id = trader.toHexString()
  let stat = TraderStat.load(id)
  if (stat == null) {
    stat = new TraderStat(id)
    stat.trader = trader
    stat.totalProfit = BigInt.fromI32(0)
    stat.totalLoss = BigInt.fromI32(0)
    stat.netPnl = BigInt.fromI32(0)
    stat.totalVolume = BigInt.fromI32(0)
    stat.tradesCount = 0
    stat.winCount = 0
    stat.save()
  }
  return stat
}

function getOrCreatePairStat(pairId: Bytes): PairStat {
  let id = pairId.toHexString()
  let stat = PairStat.load(id)
  if (stat == null) {
    stat = new PairStat(id)
    stat.longOI = BigInt.fromI32(0)
    stat.shortOI = BigInt.fromI32(0)
    stat.save()
  }
  return stat
}

function getOrCreateVaultStat(): VaultStat {
  let id = "1"
  let stat = VaultStat.load(id)
  if (stat == null) {
    stat = new VaultStat(id)
    stat.tvlUsdc = BigInt.fromI32(0)
    stat.totalShares = BigInt.fromI32(0)
    stat.save()
  }
  return stat
}
function updatePairDayData(pairId: Bytes, timestamp: BigInt, volumeUsd: BigInt): void {
  let dayId = timestamp.toI32() / 86400
  let id = pairId.toHexString() + "-" + dayId.toString()
  
  let dayData = PairDayData.load(id)
  if (dayData == null) {
    dayData = new PairDayData(id)
    dayData.pairId = pairId
    dayData.date = dayId * 86400
    dayData.volumeUsd = BigInt.fromI32(0)
  }
  
  dayData.volumeUsd = dayData.volumeUsd.plus(volumeUsd)
  dayData.save()
}

export function handlePositionOpened(event: PositionOpened): void {
  let positionId = event.params.positionId.toString()
  let position = new Position(positionId)

  position.positionId = event.params.positionId
  position.trader = event.params.trader
  position.pairId = event.params.pairId
  position.isLong = event.params.isLong
  position.sizeUsd = event.params.sizeUsd
  position.entryPrice = event.params.entryPrice
  position.leverage = event.params.leverage
  
  // Calculate collateral: sizeUsd / leverage
  if (event.params.leverage.gt(BigInt.fromI32(0))) {
    position.collateral = event.params.sizeUsd.div(event.params.leverage)
  } else {
    position.collateral = BigInt.fromI32(0)
  }
  
  let contract = ConfidentialTrading.bind(event.address)
  let posCall = contract.try_positions(event.params.positionId)
  if (!posCall.reverted) {
    position.liquidationPrice = posCall.value.getLiquidationPrice()
    position.tpPrice = posCall.value.getTpPrice()
    position.slPrice = posCall.value.getSlPrice()
  } else {
    position.liquidationPrice = BigInt.fromI32(0)
    position.tpPrice = BigInt.fromI32(0)
    position.slPrice = BigInt.fromI32(0)
  }

  position.isOpen = true
  position.openedAt = event.block.timestamp
  position.save()

  // Create Trade Record
  let trade = new TradeRecord(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
  trade.trader = event.params.trader
  trade.pairId = event.params.pairId
  trade.isLong = event.params.isLong
  trade.action = "Open"
  trade.sizeUsd = event.params.sizeUsd
  trade.price = event.params.entryPrice
  trade.pnl = BigInt.fromI32(0)
  trade.timestamp = event.block.timestamp
  trade.txHash = event.transaction.hash
  trade.save()

  // Update Daily Volume
  updatePairDayData(event.params.pairId, event.block.timestamp, event.params.sizeUsd)

  // Update Pair OI
  let stat = getOrCreatePairStat(event.params.pairId)
  if (event.params.isLong) {
    stat.longOI = stat.longOI.plus(event.params.sizeUsd)
  } else {
    stat.shortOI = stat.shortOI.plus(event.params.sizeUsd)
  }
  stat.save()
}

export function handlePositionClosed(event: PositionClosed): void {
  let positionId = event.params.positionId.toString()
  let position = Position.load(positionId)
  
  if (position != null) {
    position.isOpen = false
    position.closedAt = event.block.timestamp
    position.exitPrice = event.params.exitPrice
    position.pnl = event.params.pnl
    position.save()

    let trade = new TradeRecord(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    trade.trader = event.params.trader
    trade.pairId = position.pairId
    trade.isLong = position.isLong
    trade.action = "Close"
    trade.sizeUsd = position.sizeUsd
    trade.price = event.params.exitPrice
    trade.pnl = event.params.pnl
    trade.timestamp = event.block.timestamp
    trade.txHash = event.transaction.hash
    trade.save()

    // Update Daily Volume
    updatePairDayData(position.pairId, event.block.timestamp, position.sizeUsd)

    // Update Pair OI
    let stat = getOrCreatePairStat(position.pairId)
    if (position.isLong) {
      stat.longOI = stat.longOI.minus(position.sizeUsd)
    } else {
      stat.shortOI = stat.shortOI.minus(position.sizeUsd)
    }
    stat.save()

    // Update TraderStat
    let traderStat = getOrCreateTraderStat(position.trader)
    let pnl = event.params.pnl
    if (pnl.gt(BigInt.fromI32(0))) {
      traderStat.totalProfit = traderStat.totalProfit.plus(pnl)
      traderStat.winCount += 1
    } else if (pnl.lt(BigInt.fromI32(0))) {
      traderStat.totalLoss = traderStat.totalLoss.plus(pnl.abs())
    }
    traderStat.netPnl = traderStat.netPnl.plus(pnl)
    traderStat.totalVolume = traderStat.totalVolume.plus(position.sizeUsd)
    traderStat.tradesCount += 1
    traderStat.save()
  }
}

export function handlePositionLiquidated(event: PositionLiquidated): void {
  let positionId = event.params.positionId.toString()
  let position = Position.load(positionId)
  
  if (position != null) {
    position.isOpen = false
    position.closedAt = event.block.timestamp
    position.exitPrice = event.params.executionPrice
    position.pnl = position.collateral.times(BigInt.fromI32(-1))
    position.save()

    let trade = new TradeRecord(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    trade.trader = position.trader
    trade.pairId = position.pairId
    trade.isLong = position.isLong
    trade.action = "Liquidate"
    trade.sizeUsd = position.sizeUsd
    trade.price = position.liquidationPrice
    trade.pnl = position.collateral.times(BigInt.fromI32(-1))
    trade.timestamp = event.block.timestamp
    trade.txHash = event.transaction.hash
    trade.save()

    // Update Daily Volume
    updatePairDayData(position.pairId, event.block.timestamp, position.sizeUsd)

    // Update Pair OI
    let stat = getOrCreatePairStat(position.pairId)
    if (position.isLong) {
      stat.longOI = stat.longOI.minus(position.sizeUsd)
    } else {
      stat.shortOI = stat.shortOI.minus(position.sizeUsd)
    }
    stat.save()

    // Update TraderStat
    let traderStat = getOrCreateTraderStat(position.trader)
    let pnl = position.collateral.times(BigInt.fromI32(-1))
    traderStat.totalLoss = traderStat.totalLoss.plus(pnl.abs())
    traderStat.netPnl = traderStat.netPnl.plus(pnl)
    traderStat.totalVolume = traderStat.totalVolume.plus(position.sizeUsd)
    traderStat.tradesCount += 1
    traderStat.save()
  }
}

export function handleCollateralAdded(event: CollateralAdded): void {
  let positionId = event.params.positionId.toString()
  let position = Position.load(positionId)
  
  if (position != null) {
    // Re-read position from contract for updated values
    let contract = ConfidentialTrading.bind(event.address)
    let posCall = contract.try_positions(event.params.positionId)
    if (!posCall.reverted) {
      position.collateral = posCall.value.getCollateral()
      position.leverage = posCall.value.getLeverage()
      position.liquidationPrice = posCall.value.getLiquidationPrice()
    }
    position.save()

    let trade = new TradeRecord(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    trade.trader = event.params.trader
    trade.pairId = position.pairId
    trade.isLong = position.isLong
    trade.action = "AddCollateral"
    trade.sizeUsd = event.params.amount
    trade.price = BigInt.fromI32(0)
    trade.pnl = BigInt.fromI32(0)
    trade.timestamp = event.block.timestamp
    trade.txHash = event.transaction.hash
    trade.save()
  }
}

export function handleCollateralRemoved(event: CollateralRemoved): void {
  let positionId = event.params.positionId.toString()
  let position = Position.load(positionId)
  
  if (position != null) {
    let contract = ConfidentialTrading.bind(event.address)
    let posCall = contract.try_positions(event.params.positionId)
    if (!posCall.reverted) {
      position.collateral = posCall.value.getCollateral()
      position.leverage = posCall.value.getLeverage()
      position.liquidationPrice = posCall.value.getLiquidationPrice()
    }
    position.save()

    let trade = new TradeRecord(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    trade.trader = event.params.trader
    trade.pairId = position.pairId
    trade.isLong = position.isLong
    trade.action = "RemoveCollateral"
    trade.sizeUsd = event.params.amount
    trade.price = BigInt.fromI32(0)
    trade.pnl = BigInt.fromI32(0)
    trade.timestamp = event.block.timestamp
    trade.txHash = event.transaction.hash
    trade.save()
  }
}

export function handlePositionIncreased(event: PositionIncreased): void {
  let positionId = event.params.positionId.toString()
  let position = Position.load(positionId)
  
  if (position != null) {
    // Re-read full position from contract
    let contract = ConfidentialTrading.bind(event.address)
    let posCall = contract.try_positions(event.params.positionId)
    if (!posCall.reverted) {
      position.sizeUsd = posCall.value.getSizeUsd()
      position.collateral = posCall.value.getCollateral()
      position.leverage = posCall.value.getLeverage()
      position.liquidationPrice = posCall.value.getLiquidationPrice()
    }
    position.entryPrice = event.params.newEntryPrice
    position.save()

    let trade = new TradeRecord(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    trade.trader = event.params.trader
    trade.pairId = position.pairId
    trade.isLong = position.isLong
    trade.action = "Increase"
    trade.sizeUsd = event.params.additionalSizeUsd
    trade.price = event.params.newEntryPrice
    trade.pnl = BigInt.fromI32(0)
    trade.timestamp = event.block.timestamp
    trade.txHash = event.transaction.hash
    trade.save()

    // Update Daily Volume
    updatePairDayData(position.pairId, event.block.timestamp, event.params.additionalSizeUsd)

    // Update Pair OI
    let stat = getOrCreatePairStat(position.pairId)
    if (position.isLong) {
      stat.longOI = stat.longOI.plus(event.params.additionalSizeUsd)
    } else {
      stat.shortOI = stat.shortOI.plus(event.params.additionalSizeUsd)
    }
    stat.save()
  }
}

export function handlePositionPartialClose(event: PositionPartialClose): void {
  let positionId = event.params.positionId.toString()
  let position = Position.load(positionId)
  
  if (position != null) {
    // Re-read remaining position from contract
    let contract = ConfidentialTrading.bind(event.address)
    let posCall = contract.try_positions(event.params.positionId)
    if (!posCall.reverted) {
      position.sizeUsd = posCall.value.getSizeUsd()
      position.collateral = posCall.value.getCollateral()
      position.leverage = posCall.value.getLeverage()
      position.liquidationPrice = posCall.value.getLiquidationPrice()
    }
    position.save()

    let trade = new TradeRecord(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    trade.trader = event.params.trader
    trade.pairId = position.pairId
    trade.isLong = position.isLong
    trade.action = "PartialClose"
    trade.sizeUsd = event.params.closeSizeUsd
    trade.price = event.params.exitPrice
    trade.pnl = event.params.pnl
    trade.timestamp = event.block.timestamp
    trade.txHash = event.transaction.hash
    trade.save()

    // Update Daily Volume
    updatePairDayData(position.pairId, event.block.timestamp, event.params.closeSizeUsd)

    // Update Pair OI
    let stat = getOrCreatePairStat(position.pairId)
    if (position.isLong) {
      stat.longOI = stat.longOI.minus(event.params.closeSizeUsd)
    } else {
      stat.shortOI = stat.shortOI.minus(event.params.closeSizeUsd)
    }
    stat.save()
  }
}

export function handleOrderPlaced(event: OrderPlaced): void {
  // Only index Limit (0), Stop Market (1), and TWAP (4) as standing orders
  if (event.params.orderType != 0 && event.params.orderType != 1 && event.params.orderType != 4) {
    return
  }

  let orderId = event.params.orderId.toString()
  let order = new Order(orderId)

  order.orderId = event.params.orderId
  order.trader = event.params.trader
  order.pairId = event.params.pairId
  order.orderType = event.params.orderType
  order.triggerPrice = event.params.triggerPrice
  
  let contract = ConfidentialTrading.bind(event.address)
  let orderCall = contract.try_pendingOrders(event.params.orderId)
  
  if (!orderCall.reverted) {
    order.isLong = orderCall.value.getIsLong()
    order.sizeUsd = orderCall.value.getSizeUsd()
    order.leverage = orderCall.value.getLeverage()
    order.collateral = orderCall.value.getCollateral()
    order.tpPrice = orderCall.value.getTpPrice()
    order.slPrice = orderCall.value.getSlPrice()
    order.twapSlices = orderCall.value.getTwapSlices()
    order.twapExecuted = orderCall.value.getTwapExecuted()
  } else {
    order.isLong = true
    order.sizeUsd = BigInt.fromI32(0)
    order.leverage = BigInt.fromI32(1)
    order.collateral = BigInt.fromI32(0)
    order.tpPrice = BigInt.fromI32(0)
    order.slPrice = BigInt.fromI32(0)
    order.twapSlices = BigInt.fromI32(0)
    order.twapExecuted = BigInt.fromI32(0)
  }

  order.isActive = true
  order.createdAt = event.block.timestamp
  order.save()
}

export function handleOrderCancelled(event: OrderCancelled): void {
  let orderId = event.params.orderId.toString()
  let order = Order.load(orderId)
  if (order != null) {
    order.isActive = false
    order.save()
  }
}

export function handleOrderExecuted(event: OrderExecuted): void {
  let orderId = event.params.orderId.toString()
  let order = Order.load(orderId)
  if (order != null) {
    order.isActive = false
    order.executedAt = event.block.timestamp
    order.positionId = event.params.positionId
    order.save()
  }
}

export function handleTWAPSliceExecuted(event: TWAPSliceExecuted): void {
  let orderId = event.params.orderId.toString()
  let order = Order.load(orderId)
  if (order != null) {
    order.twapExecuted = event.params.sliceNumber
    order.save()
  }
}

export function handleTPSLTriggered(event: TPSLTriggered): void {
  // Logic handled in handlePositionClosed which follows immediately
}

export function handleDeposit(event: Deposit): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let deposit = new VaultDeposit(id)
  
  deposit.user = event.params.user
  deposit.action = "deposit"
  deposit.amount = event.params.amount
  deposit.shares = event.params.sharesReceived
  deposit.isDegen = event.params.isDegen
  deposit.timestamp = event.block.timestamp
  deposit.txHash = event.transaction.hash
  deposit.save()

  // Update Vault TVL
  let stat = getOrCreateVaultStat()
  stat.tvlUsdc = stat.tvlUsdc.plus(event.params.amount)
  stat.totalShares = stat.totalShares.plus(event.params.sharesReceived)
  stat.save()
}

export function handleWithdraw(event: Withdraw): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let withdraw = new VaultDeposit(id)
  
  withdraw.user = event.params.user
  withdraw.action = "withdraw"
  withdraw.amount = event.params.amount
  withdraw.shares = event.params.sharesBurned
  withdraw.isDegen = event.params.isDegen
  withdraw.timestamp = event.block.timestamp
  withdraw.txHash = event.transaction.hash
  withdraw.save()

  // Update Vault TVL
  let stat = getOrCreateVaultStat()
  stat.tvlUsdc = stat.tvlUsdc.minus(event.params.amount)
  stat.totalShares = stat.totalShares.minus(event.params.sharesBurned)
  stat.save()
}
