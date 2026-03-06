import { Price, TokenPrecision } from "warthog-ts";

const formatWalletAddress = (
  address: string,
  startLength: number = 10,
  endLength: number = 10,
): string => {
  return `${address.slice(0, startLength)}....${address.slice(-endLength)}`;
};

const parsePriceInput = (value: string): Price | null => {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return null;
  return Price.fromNumberPrecision(num, new TokenPrecision(4), false);
};

export { formatWalletAddress, parsePriceInput };
