import { getRules } from './transformationRules';

export function transformText(text: string, level: number, isSimplifying: boolean): string {
  const rules = getRules(level, isSimplifying);
  
  return text
    .split('. ')
    .map(sentence => {
      let transformed = sentence;
      rules.forEach(rule => {
        transformed = transformed.replace(rule.from, rule.to);
      });
      return transformed;
    })
    .join('. ');
}