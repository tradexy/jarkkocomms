export type Category = "energy" | "metals" | "agriculture";

export type Instrument = {
  symbol: string;
  tvSymbol: string;
  finviz: string;
  ticker: string;
  name: string;
  unit: string;
  category: Category;
  featured?: boolean;
};

export const INSTRUMENTS: Instrument[] = [
  { symbol: "CL=F", tvSymbol: "NYMEX:CL1!", finviz: "CL", ticker: "WTI", name: "WTI Crude Oil", unit: "USD / bbl", category: "energy", featured: true },
  { symbol: "BZ=F", tvSymbol: "ICEEUR:BRN1!", finviz: "BZ", ticker: "BRENT", name: "Brent Crude", unit: "USD / bbl", category: "energy", featured: true },
  { symbol: "HO=F", tvSymbol: "NYMEX:HO1!", finviz: "HO", ticker: "HO", name: "NY Harbor ULSD", unit: "USD / gal", category: "energy", featured: true },
  { symbol: "RB=F", tvSymbol: "NYMEX:RB1!", finviz: "RB", ticker: "RBOB", name: "RBOB Gasoline", unit: "USD / gal", category: "energy", featured: true },
  { symbol: "NG=F", tvSymbol: "NYMEX:NG1!", finviz: "NG", ticker: "NG", name: "Henry Hub Nat Gas", unit: "USD / MMBtu", category: "energy", featured: true },
  { symbol: "GC=F", tvSymbol: "COMEX:GC1!", finviz: "GC", ticker: "GOLD", name: "Gold", unit: "USD / oz", category: "metals" },
  { symbol: "SI=F", tvSymbol: "COMEX:SI1!", finviz: "SI", ticker: "SILVER", name: "Silver", unit: "USD / oz", category: "metals" },
  { symbol: "HG=F", tvSymbol: "COMEX:HG1!", finviz: "HG", ticker: "COPPER", name: "Copper", unit: "USD / lb", category: "metals" },
  { symbol: "PL=F", tvSymbol: "NYMEX:PL1!", finviz: "PL", ticker: "PLAT", name: "Platinum", unit: "USD / oz", category: "metals" },
  { symbol: "PA=F", tvSymbol: "NYMEX:PA1!", finviz: "PA", ticker: "PALL", name: "Palladium", unit: "USD / oz", category: "metals" },
  { symbol: "ZC=F", tvSymbol: "CBOT:ZC1!", finviz: "C", ticker: "CORN", name: "Corn", unit: "¢ / bu", category: "agriculture" },
  { symbol: "ZS=F", tvSymbol: "CBOT:ZS1!", finviz: "S", ticker: "SOY", name: "Soybeans", unit: "¢ / bu", category: "agriculture" },
  { symbol: "ZW=F", tvSymbol: "CBOT:ZW1!", finviz: "W", ticker: "WHEAT", name: "Chicago Wheat", unit: "¢ / bu", category: "agriculture" },
  { symbol: "KC=F", tvSymbol: "ICEUS:KC1!", finviz: "KC", ticker: "COFFEE", name: "Coffee C", unit: "¢ / lb", category: "agriculture" },
  { symbol: "SB=F", tvSymbol: "ICEUS:SB1!", finviz: "SB", ticker: "SUGAR", name: "Sugar No. 11", unit: "¢ / lb", category: "agriculture" },
  { symbol: "CC=F", tvSymbol: "ICEUS:CC1!", finviz: "CC", ticker: "COCOA", name: "Cocoa", unit: "USD / MT", category: "agriculture" },
];

export const SYMBOLS = INSTRUMENTS.map((item) => item.symbol);

export const CATEGORY_LABEL: Record<Category | "all", string> = {
  all: "All markets",
  energy: "Energy",
  metals: "Metals",
  agriculture: "Agriculture",
};

export function instrumentBySymbol(symbol: string) {
  return INSTRUMENTS.find((item) => item.symbol === symbol);
}

export function instrumentByTv(tvSymbol: string) {
  return INSTRUMENTS.find((item) => item.tvSymbol === tvSymbol);
}
