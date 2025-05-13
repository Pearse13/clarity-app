// Level 1 rules (simplest/most complex)
const simplificationRulesL1 = [
  { from: /utilize/g, to: 'use' },
  { from: /implement/g, to: 'do' },
  { from: /facilitate/g, to: 'help' },
  { from: /subsequently/g, to: 'then' },
  { from: /nevertheless/g, to: 'but' },
  { from: /approximately/g, to: 'about' },
  { from: /sufficient/g, to: 'enough' },
  { from: /attempt/g, to: 'try' },
  { from: /determine/g, to: 'find out' },
  { from: /require/g, to: 'need' },
  { from: /\bconclude\b/g, to: 'end' },
  { from: /\binitiate\b/g, to: 'start' },
  { from: /\bproceed\b/g, to: 'go' },
  { from: /\bobtain\b/g, to: 'get' },
  { from: /\bpurchase\b/g, to: 'buy' }
];

const complexityRulesL5 = [
  { from: /\buse\b/g, to: 'utilize' },
  { from: /\bhelp\b/g, to: 'facilitate' },
  { from: /\bthen\b/g, to: 'subsequently' },
  { from: /\bbut\b/g, to: 'nevertheless' },
  { from: /\bmake\b/g, to: 'implement' },
  { from: /\bshow\b/g, to: 'demonstrate' },
  { from: /\bget\b/g, to: 'obtain' },
  { from: /\bstart\b/g, to: 'initiate' },
  { from: /\bend\b/g, to: 'conclude' },
  { from: /\bdo\b/g, to: 'execute' },
  { from: /\bsay\b/g, to: 'articulate' },
  { from: /\bthink\b/g, to: 'contemplate' },
  { from: /\bwork\b/g, to: 'endeavor' },
  { from: /\btry\b/g, to: 'attempt' },
  { from: /\bneed\b/g, to: 'necessitate' }
];

export const getRules = (level: number, isSimplifying: boolean) => {
  const maxRules = isSimplifying ? simplificationRulesL1 : complexityRulesL5;
  const rulesPerLevel = Math.ceil(maxRules.length / 5);
  const numRules = isSimplifying 
    ? Math.ceil((6 - level) * rulesPerLevel) // More rules for lower levels when simplifying
    : Math.ceil(level * rulesPerLevel);      // More rules for higher levels when complexifying
  
  return maxRules.slice(0, numRules);
};