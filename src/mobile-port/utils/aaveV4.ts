/**
 * Aave v4 on Ethereum mainnet, Main Spoke only.
 *
 * Users call the Spoke directly. The function signatures below are a hand-written minimal
 * fragment of the deployed Spoke's public interface (no contract source is copied). Each one was
 * checked with live eth_call reads/simulations against the deployed Main Spoke before use.
 * See https://aave.com/docs/aave-v4 for the model.
 *
 * Borrowing uses the Spoke directly: it sends WETH to the caller, and the wallet can then unwrap it
 * with WETH.withdraw. The optional NativeTokenGateway is not used because it would need the user to
 * grant that contract position-manager rights on their position.
 *
 * Nothing here handles keys. Transactions go through `sendEthCall` in ethChain.ts.
 */
import { ethers } from 'ethers';
import { ETH_CHAIN_ID, ETH_RPC, ETH_USDC, ETH_USDT, ETH_WBTC, ETH_WETH } from './ethTokens';
import { parseTokenAmount, sendEthCall } from './ethChain';

export const AAVE_MAIN_SPOKE = '0x94e7A5dCbE816e498b89aB752661904E2F56c485';
export const AAVE_CORE_HUB = '0xCca852Bc40e560adC3b1Cc58CA5b55638ce826c9';

/** The wallet refuses to build a borrow or withdrawal that would end below this health factor. */
export const MIN_SAFE_HEALTH_FACTOR = 1.5;
const MIN_SAFE_WAD = 15n * 10n ** 17n;
const WAD = 10n ** 18n;
const RAY = 10n ** 27n;
/** Largest share of a hub-side limit (remaining cap, pool liquidity) this wallet offers to use. */
const LIMIT_USE_BPS = 9_000n;
/** Extra approved/wrapped on a full repay so interest accrued before mining still clears. */
const FULL_REPAY_BUFFER_BPS = 10_005n;

export type AaveRole = 'collateral' | 'borrow';

export interface AaveReserveDef {
  id: number;
  symbol: string;
  underlying: string;
  decimals: number;
  role: AaveRole;
}

/**
 * Reserve ids on the Main Spoke. `loadAaveMarket` re-checks each id against `getReserve(id).underlying`
 * and drops any reserve whose underlying no longer matches.
 */
export const AAVE_RESERVES: AaveReserveDef[] = [
  { id: 0, symbol: 'WETH', underlying: ETH_WETH, decimals: 18, role: 'borrow' },
  { id: 1, symbol: 'wstETH', underlying: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', decimals: 18, role: 'collateral' },
  { id: 2, symbol: 'weETH', underlying: '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee', decimals: 18, role: 'collateral' },
  { id: 3, symbol: 'WBTC', underlying: ETH_WBTC, decimals: 8, role: 'collateral' },
  { id: 4, symbol: 'cbBTC', underlying: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', decimals: 8, role: 'collateral' },
  { id: 7, symbol: 'USDC', underlying: ETH_USDC, decimals: 6, role: 'collateral' },
  { id: 8, symbol: 'USDT', underlying: ETH_USDT, decimals: 6, role: 'collateral' },
];

export const WETH_RESERVE_ID = 0;

const SPOKE_ABI = [
  'function supply(uint256 reserveId, uint256 amount, address onBehalfOf) returns (uint256, uint256)',
  'function withdraw(uint256 reserveId, uint256 amount, address onBehalfOf) returns (uint256, uint256)',
  'function borrow(uint256 reserveId, uint256 amount, address onBehalfOf) returns (uint256, uint256)',
  'function repay(uint256 reserveId, uint256 amount, address onBehalfOf) returns (uint256, uint256)',
  'function setUsingAsCollateral(uint256 reserveId, bool usingAsCollateral, address onBehalfOf)',
  'function ORACLE() view returns (address)',
  'function getReserve(uint256 reserveId) view returns (tuple(address underlying, address hub, uint16 assetId, uint8 decimals, uint24 collateralRisk, uint8 flags, uint32 dynamicConfigKey))',
  'function getReserveConfig(uint256 reserveId) view returns (tuple(uint24 collateralRisk, bool paused, bool frozen, bool borrowable, bool receiveSharesEnabled))',
  'function getDynamicReserveConfig(uint256 reserveId, uint32 dynamicConfigKey) view returns (tuple(uint16 collateralFactor, uint32 maxLiquidationBonus, uint16 liquidationFee))',
  'function getUserSuppliedAssets(uint256 reserveId, address user) view returns (uint256)',
  'function getUserTotalDebt(uint256 reserveId, address user) view returns (uint256)',
  'function getUserReserveStatus(uint256 reserveId, address user) view returns (bool, bool)',
  'function getUserPosition(uint256 reserveId, address user) view returns (tuple(uint120 drawnShares, uint120 premiumShares, int200 premiumOffsetRay, uint120 suppliedShares, uint32 dynamicConfigKey))',
  'function getUserAccountData(address user) view returns (tuple(uint256 riskPremium, uint256 avgCollateralFactor, uint256 healthFactor, uint256 totalCollateralValue, uint256 totalDebtValueRay, uint256 activeCollateralCount, uint256 borrowCount))',
];

const HUB_ABI = [
  'function getSpoke(uint256 assetId, address spoke) view returns (tuple(uint120 drawnShares, uint120 premiumShares, int200 premiumOffsetRay, uint120 addedShares, uint40 addCap, uint40 drawCap, uint24 riskPremiumThreshold, bool active, bool halted, uint200 deficitRay))',
  'function getSpokeAddedAssets(uint256 assetId, address spoke) view returns (uint256)',
  'function getSpokeTotalOwed(uint256 assetId, address spoke) view returns (uint256)',
  'function getAssetLiquidity(uint256 assetId) view returns (uint256)',
  'function getAssetDrawnRate(uint256 assetId) view returns (uint256)',
  'function MAX_ALLOWED_SPOKE_CAP() view returns (uint40)',
];

const ORACLE_ABI = [
  'function decimals() view returns (uint8)',
  'function getReservePrice(uint256 reserveId) view returns (uint256)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256)',
];

const WETH_ABI = [
  'function deposit() payable',
  'function withdraw(uint256 wad)',
];

const spokeIface = new ethers.Interface(SPOKE_ABI);
const erc20Iface = new ethers.Interface(ERC20_ABI);
const wethIface = new ethers.Interface(WETH_ABI);

export interface AaveReserveState extends AaveReserveDef {
  /** Price in USD with `priceDecimals` places. */
  price: bigint;
  walletBalance: bigint;
  supplied: bigint;
  debt: bigint;
  enabledAsCollateral: boolean;
  /** Collateral factor in basis points for this user's position (0 if it does not count). */
  collateralFactorBps: number;
  frozen: boolean;
  paused: boolean;
  borrowable: boolean;
  /** Most that can still be supplied under the Spoke's cap on the Hub, in raw units. */
  supplyRoom: bigint;
  /** Most that can still be borrowed under the Spoke's draw cap and Hub liquidity, in raw units. */
  borrowRoom: bigint;
  /** Hub drawn rate in RAY. Zero when no rate is read. */
  drawnRateRay: bigint;
}

export interface AaveAccount {
  /** Health factor in WAD. `null` means no debt. */
  healthFactorWad: bigint | null;
  riskPremiumBps: number;
  avgCollateralFactorWad: bigint;
  /** Raw "Value" units straight from the Spoke (USD, 8 decimals, scaled by 1e18). */
  totalCollateralValue: bigint;
  /** Raw debt "Value" scaled by RAY. */
  totalDebtValueRay: bigint;
  borrowCount: number;
  activeCollateralCount: number;
}

export interface AaveMarket {
  block: number;
  priceDecimals: number;
  account: AaveAccount;
  reserves: AaveReserveState[];
  ethBalance: bigint;
  /** True when the Spoke reported a reserve whose underlying did not match the wallet's table. */
  skipped: string[];
}

function provider(): ethers.JsonRpcProvider {
  const network = ethers.Network.from(ETH_CHAIN_ID);
  return new ethers.JsonRpcProvider(ETH_RPC, network, { staticNetwork: network });
}

function minBig(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

/** Whole-asset cap -> raw units. A cap at the Hub's maximum means "no cap". */
function capRaw(cap: bigint, max: bigint, decimals: number): bigint | null {
  if (cap >= max) return null;
  return cap * 10n ** BigInt(decimals);
}

function roomUnder(cap: bigint | null, used: bigint): bigint {
  if (cap == null) return ethers.MaxUint256;
  return cap > used ? cap - used : 0n;
}

export async function loadAaveMarket(user: string): Promise<AaveMarket> {
  const owner = ethers.getAddress(user);
  const client = provider();
  try {
    const hex = await client.send('eth_chainId', []);
    if (BigInt(hex) !== BigInt(ETH_CHAIN_ID)) throw new Error('Ethereum RPC is not mainnet.');
    const spoke = new ethers.Contract(AAVE_MAIN_SPOKE, SPOKE_ABI, client);
    const hub = new ethers.Contract(AAVE_CORE_HUB, HUB_ABI, client);
    const oracleAddress = await spoke.ORACLE() as string;
    const oracle = new ethers.Contract(oracleAddress, ORACLE_ABI, client);
    const [block, priceDecimalsRaw, maxCap, acct, ethBalance] = await Promise.all([
      client.getBlockNumber(),
      oracle.decimals() as Promise<bigint>,
      hub.MAX_ALLOWED_SPOKE_CAP() as Promise<bigint>,
      spoke.getUserAccountData(owner) as Promise<ethers.Result>,
      client.getBalance(owner),
    ]);
    const skipped: string[] = [];
    const rows = await Promise.all(AAVE_RESERVES.map(async (def): Promise<AaveReserveState | null> => {
      const reserve = await spoke.getReserve(def.id) as ethers.Result;
      if (String(reserve.underlying).toLowerCase() !== def.underlying.toLowerCase()
        || Number(reserve.decimals) !== def.decimals) {
        skipped.push(def.symbol);
        return null;
      }
      const token = new ethers.Contract(def.underlying, ERC20_ABI, client);
      const assetId = BigInt(reserve.assetId);
      const [config, position, supplied, debt, status, price, balance, hubSpoke, added, owed, liquidity, rate] = await Promise.all([
        spoke.getReserveConfig(def.id) as Promise<ethers.Result>,
        spoke.getUserPosition(def.id, owner) as Promise<ethers.Result>,
        spoke.getUserSuppliedAssets(def.id, owner) as Promise<bigint>,
        spoke.getUserTotalDebt(def.id, owner) as Promise<bigint>,
        spoke.getUserReserveStatus(def.id, owner) as Promise<ethers.Result>,
        oracle.getReservePrice(def.id) as Promise<bigint>,
        token.balanceOf(owner) as Promise<bigint>,
        hub.getSpoke(assetId, AAVE_MAIN_SPOKE) as Promise<ethers.Result>,
        hub.getSpokeAddedAssets(assetId, AAVE_MAIN_SPOKE) as Promise<bigint>,
        hub.getSpokeTotalOwed(assetId, AAVE_MAIN_SPOKE) as Promise<bigint>,
        hub.getAssetLiquidity(assetId) as Promise<bigint>,
        hub.getAssetDrawnRate(assetId) as Promise<bigint>,
      ]);
      // Use the dynamic config the user's own position is on, falling back to the reserve's latest one.
      const key = supplied > 0n ? Number(position.dynamicConfigKey) : Number(reserve.dynamicConfigKey);
      const dyn = await spoke.getDynamicReserveConfig(def.id, key) as ethers.Result;
      const active = Boolean(hubSpoke.active) && !hubSpoke.halted;
      const addRoom = active ? roomUnder(capRaw(BigInt(hubSpoke.addCap), maxCap, def.decimals), added) : 0n;
      const drawRoom = active
        ? minBig(roomUnder(capRaw(BigInt(hubSpoke.drawCap), maxCap, def.decimals), owed), liquidity)
        : 0n;
      return {
        ...def,
        price,
        walletBalance: balance,
        supplied,
        debt,
        enabledAsCollateral: Boolean(status[0]),
        collateralFactorBps: Number(dyn.collateralFactor),
        frozen: Boolean(config.frozen),
        paused: Boolean(config.paused),
        borrowable: Boolean(config.borrowable),
        supplyRoom: addRoom,
        borrowRoom: drawRoom,
        drawnRateRay: rate,
      };
    }));
    const healthRaw = BigInt(acct.healthFactor);
    return {
      block,
      priceDecimals: Number(priceDecimalsRaw),
      account: {
        healthFactorWad: BigInt(acct.borrowCount) === 0n || BigInt(acct.totalDebtValueRay) === 0n ? null : healthRaw,
        riskPremiumBps: Number(acct.riskPremium),
        avgCollateralFactorWad: BigInt(acct.avgCollateralFactor),
        totalCollateralValue: BigInt(acct.totalCollateralValue),
        totalDebtValueRay: BigInt(acct.totalDebtValueRay),
        borrowCount: Number(acct.borrowCount),
        activeCollateralCount: Number(acct.activeCollateralCount),
      },
      reserves: rows.filter((row): row is AaveReserveState => row != null),
      ethBalance,
      skipped,
    };
  } finally {
    client.destroy();
  }
}

/** Value of a raw token amount in the Spoke's "Value" units (USD 8 decimals x 1e18). */
export function valueOf(amount: bigint, price: bigint, decimals: number): bigint {
  return amount * price * WAD / 10n ** BigInt(decimals);
}

function healthWad(weightedWad: bigint, debtRay: bigint): bigint | null {
  if (debtRay <= 0n) return null;
  return weightedWad * RAY / debtRay;
}

/** Health factor after taking on `extraDebt` raw WETH. `null` means still no debt. */
export function healthAfterBorrow(market: AaveMarket, weth: AaveReserveState, extraDebt: bigint): bigint | null {
  const a = market.account;
  const weighted = a.totalCollateralValue * a.avgCollateralFactorWad;
  const debtRay = a.totalDebtValueRay + valueOf(extraDebt, weth.price, weth.decimals) * RAY;
  return healthWad(weighted, debtRay);
}

/** Health factor after withdrawing `amount` raw units of `reserve`. */
export function healthAfterWithdraw(market: AaveMarket, reserve: AaveReserveState, amount: bigint): bigint | null {
  const a = market.account;
  if (a.totalDebtValueRay <= 0n) return null;
  let weighted = a.totalCollateralValue * a.avgCollateralFactorWad;
  if (reserve.enabledAsCollateral && reserve.collateralFactorBps > 0) {
    const removed = valueOf(amount, reserve.price, reserve.decimals) * BigInt(reserve.collateralFactorBps) * 10n ** 14n;
    weighted = weighted > removed ? weighted - removed : 0n;
  }
  return healthWad(weighted, a.totalDebtValueRay);
}

/** Health factor after repaying `amount` raw WETH. */
export function healthAfterRepay(market: AaveMarket, weth: AaveReserveState, amount: bigint): bigint | null {
  const a = market.account;
  const weighted = a.totalCollateralValue * a.avgCollateralFactorWad;
  const repaid = valueOf(amount, weth.price, weth.decimals) * RAY;
  const debtRay = a.totalDebtValueRay > repaid ? a.totalDebtValueRay - repaid : 0n;
  return healthWad(weighted, debtRay);
}

/** Largest WETH amount that keeps the health factor at `MIN_SAFE_HEALTH_FACTOR` or above, within the hub limits. */
export function maxSafeBorrow(market: AaveMarket, weth: AaveReserveState): bigint {
  const a = market.account;
  if (!weth.borrowable || weth.frozen || weth.paused) return 0n;
  const weighted = a.totalCollateralValue * a.avgCollateralFactorWad;
  const allowedDebtRay = weighted * RAY / MIN_SAFE_WAD;
  if (allowedDebtRay <= a.totalDebtValueRay) return 0n;
  const headroomValue = (allowedDebtRay - a.totalDebtValueRay) / RAY;
  const byHealth = headroomValue * 10n ** BigInt(weth.decimals) / (weth.price * WAD);
  const byLimits = weth.borrowRoom === ethers.MaxUint256 ? byHealth : weth.borrowRoom * LIMIT_USE_BPS / 10_000n;
  return minBig(byHealth, byLimits);
}

/** Largest withdrawal that keeps the health factor safe. With no debt it is the whole supply. */
export function maxSafeWithdraw(market: AaveMarket, reserve: AaveReserveState): bigint {
  if (reserve.supplied <= 0n) return 0n;
  const a = market.account;
  if (a.totalDebtValueRay <= 0n || !reserve.enabledAsCollateral || reserve.collateralFactorBps === 0) {
    return reserve.supplied;
  }
  const weighted = a.totalCollateralValue * a.avgCollateralFactorWad;
  const keep = a.totalDebtValueRay * MIN_SAFE_WAD / RAY;
  if (weighted <= keep) return 0n;
  const removableWeighted = weighted - keep;
  const weightPerWholeUnit = reserve.price * BigInt(reserve.collateralFactorBps) * 10n ** 14n * WAD;
  if (weightPerWholeUnit <= 0n) return reserve.supplied;
  return minBig(reserve.supplied, removableWeighted * 10n ** BigInt(reserve.decimals) / weightPerWholeUnit);
}

export function healthToNumber(wad: bigint | null): number | null {
  if (wad == null) return null;
  if (wad > 1_000_000n * WAD) return Infinity;
  return Number(wad / 10n ** 12n) / 1e6;
}

export function formatHealth(wad: bigint | null): string {
  const n = healthToNumber(wad);
  if (n == null || !Number.isFinite(n)) return 'No debt';
  return n.toFixed(2);
}

/** Approximate annual percentage of the Hub's drawn rate. Excludes the user's risk premium. */
export function rateToPercent(rateRay: bigint): string {
  const bps = rateRay * 10_000n / RAY;
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

export function usdOf(amount: bigint, price: bigint, decimals: number, priceDecimals: number): number {
  const scaled = amount * price / 10n ** BigInt(decimals);
  return Number(scaled) / 10 ** priceDecimals;
}

export type AaveStep = {
  label: string;
  to: string;
  data: string;
  value?: bigint;
};

function approveStep(token: string, symbol: string, amount: bigint): AaveStep {
  return {
    label: `Approve ${symbol} for the Aave Main Spoke`,
    to: token,
    data: erc20Iface.encodeFunctionData('approve', [AAVE_MAIN_SPOKE, amount]),
  };
}

async function readAllowance(token: string, owner: string): Promise<bigint> {
  const client = provider();
  try {
    return await new ethers.Contract(token, ERC20_ABI, client).allowance(owner, AAVE_MAIN_SPOKE) as bigint;
  } finally {
    client.destroy();
  }
}

async function readWethBalance(owner: string): Promise<bigint> {
  const client = provider();
  try {
    return await new ethers.Contract(ETH_WETH, ERC20_ABI, client).balanceOf(owner) as bigint;
  } finally {
    client.destroy();
  }
}

/** Approve exactly `amount`. USDT-style tokens need the allowance reset to zero first. */
async function approvalSteps(reserve: AaveReserveDef, owner: string, amount: bigint): Promise<AaveStep[]> {
  const current = await readAllowance(reserve.underlying, owner);
  if (current >= amount) return [];
  const steps: AaveStep[] = [];
  if (current > 0n) steps.push(approveStep(reserve.underlying, reserve.symbol, 0n));
  steps.push(approveStep(reserve.underlying, reserve.symbol, amount));
  return steps;
}

export function parseAaveAmount(text: string, decimals: number): bigint {
  return parseTokenAmount(text, decimals);
}

/** Supply `amount` and make sure the reserve is enabled as collateral. */
export async function planSupply(
  owner: string,
  reserve: AaveReserveState,
  amount: bigint,
): Promise<AaveStep[]> {
  if (reserve.role !== 'collateral') throw new Error(`${reserve.symbol} is not offered as collateral here.`);
  if (reserve.paused || reserve.frozen) throw new Error(`${reserve.symbol} is paused or frozen on Aave.`);
  if (reserve.collateralFactorBps <= 0) throw new Error(`${reserve.symbol} does not count as collateral on the Main Spoke.`);
  if (amount > reserve.walletBalance) throw new Error(`Only ${ethers.formatUnits(reserve.walletBalance, reserve.decimals)} ${reserve.symbol} is in this wallet.`);
  if (amount > reserve.supplyRoom) throw new Error(`Aave's supply cap for ${reserve.symbol} leaves room for ${ethers.formatUnits(reserve.supplyRoom, reserve.decimals)}.`);
  const steps = await approvalSteps(reserve, owner, amount);
  steps.push({
    label: `Supply ${reserve.symbol}`,
    to: AAVE_MAIN_SPOKE,
    data: spokeIface.encodeFunctionData('supply', [reserve.id, amount, owner]),
  });
  if (!reserve.enabledAsCollateral) {
    steps.push({
      label: `Enable ${reserve.symbol} as collateral`,
      to: AAVE_MAIN_SPOKE,
      data: spokeIface.encodeFunctionData('setUsingAsCollateral', [reserve.id, true, owner]),
    });
  }
  return steps;
}

/** Borrow WETH from the Spoke, then optionally unwrap it to ETH. Blocks a borrow that ends under the safe health factor. */
export function planBorrow(
  owner: string,
  market: AaveMarket,
  weth: AaveReserveState,
  amount: bigint,
  unwrap: boolean,
): AaveStep[] {
  if (!weth.borrowable || weth.paused || weth.frozen) throw new Error('Borrowing WETH is turned off on Aave right now.');
  if (amount > weth.borrowRoom) throw new Error('That is above the remaining WETH borrow cap or pool liquidity.');
  const after = healthAfterBorrow(market, weth, amount);
  if (after != null && after < MIN_SAFE_WAD) {
    throw new Error(`Blocked: this borrow would leave a health factor of ${formatHealth(after)}. This wallet requires at least ${MIN_SAFE_HEALTH_FACTOR.toFixed(1)}.`);
  }
  const steps: AaveStep[] = [{
    label: 'Borrow WETH',
    to: AAVE_MAIN_SPOKE,
    data: spokeIface.encodeFunctionData('borrow', [WETH_RESERVE_ID, amount, owner]),
  }];
  if (unwrap) {
    steps.push({
      label: 'Unwrap the borrowed WETH to ETH',
      to: ETH_WETH,
      data: wethIface.encodeFunctionData('withdraw', [amount]),
    });
  }
  return steps;
}

/**
 * Repay WETH debt. Wraps ETH for any shortfall, approves, then repays. `full` repays everything, with a
 * small buffer wrapped and approved so interest accrued before mining still clears.
 */
export async function planRepay(
  owner: string,
  market: AaveMarket,
  weth: AaveReserveState,
  amount: bigint,
  full: boolean,
): Promise<AaveStep[]> {
  if (weth.debt <= 0n) throw new Error('There is no WETH debt to repay.');
  if (!full && amount > weth.debt) throw new Error('That is more than the WETH debt.');
  const need = full ? weth.debt * FULL_REPAY_BUFFER_BPS / 10_000n : amount;
  const wethBalance = await readWethBalance(owner);
  const steps: AaveStep[] = [];
  if (wethBalance < need) {
    const shortfall = need - wethBalance;
    if (shortfall > market.ethBalance) {
      throw new Error('Not enough ETH and WETH in this wallet for that repayment plus gas.');
    }
    steps.push({
      label: 'Wrap ETH to WETH for the repayment',
      to: ETH_WETH,
      data: wethIface.encodeFunctionData('deposit'),
      value: shortfall,
    });
  }
  steps.push(...await approvalSteps(weth, owner, need));
  steps.push({
    label: full ? 'Repay all WETH debt' : 'Repay WETH',
    to: AAVE_MAIN_SPOKE,
    data: spokeIface.encodeFunctionData('repay', [WETH_RESERVE_ID, full ? ethers.MaxUint256 : amount, owner]),
  });
  return steps;
}

/** Withdraw supplied collateral. `full` passes MaxUint256, which the Spoke treats as a full withdrawal. */
export function planWithdraw(
  owner: string,
  market: AaveMarket,
  reserve: AaveReserveState,
  amount: bigint,
  full: boolean,
): AaveStep[] {
  if (reserve.supplied <= 0n) throw new Error(`No ${reserve.symbol} is supplied.`);
  if (!full && amount > reserve.supplied) throw new Error(`Only ${ethers.formatUnits(reserve.supplied, reserve.decimals)} ${reserve.symbol} is supplied.`);
  const sent = full ? reserve.supplied : amount;
  const after = healthAfterWithdraw(market, reserve, sent);
  if (after != null && after < MIN_SAFE_WAD) {
    throw new Error(`Blocked: this withdrawal would leave a health factor of ${formatHealth(after)}. This wallet requires at least ${MIN_SAFE_HEALTH_FACTOR.toFixed(1)}.`);
  }
  return [{
    label: `Withdraw ${reserve.symbol}`,
    to: AAVE_MAIN_SPOKE,
    data: spokeIface.encodeFunctionData('withdraw', [reserve.id, full ? ethers.MaxUint256 : amount, owner]),
  }];
}

/** Sends each step in order through the wallet's existing Ethereum signer. Stops at the first failure. */
export async function runAaveSteps(
  steps: AaveStep[],
  onStep: (label: string, index: number, total: number) => void,
): Promise<string> {
  let last = '';
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    onStep(step.label, i + 1, steps.length);
    const receipt = await sendEthCall({ to: step.to, data: step.data, value: step.value });
    last = receipt.hash;
  }
  return last;
}
