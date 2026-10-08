export interface ModelPricing { inputPerMillionUsd:number; outputPerMillionUsd:number; }

const GROQ_PRICING:Record<string,ModelPricing>={
  'openai/gpt-oss-120b':{inputPerMillionUsd:0.15,outputPerMillionUsd:0.60},
  'openai/gpt-oss-20b':{inputPerMillionUsd:0.075,outputPerMillionUsd:0.30}
};

export function getModelPricing(model:string):ModelPricing|null{return GROQ_PRICING[model]??null;}

export function estimateGroqCost(model:string,inputTokens:number,outputTokens:number):number{
  const p=getModelPricing(model);
  if(!p)return 0;
  return (inputTokens/1_000_000)*p.inputPerMillionUsd+(outputTokens/1_000_000)*p.outputPerMillionUsd;
}
