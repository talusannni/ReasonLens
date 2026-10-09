import {readFile} from 'node:fs/promises';
import {evaluateEvaluationRegression,DEFAULT_EVALUATION_REGRESSION_CONFIG,type EvaluationRegressionConfig} from '../lib/evaluation-regression';
import type {EvaluationRun} from '../lib/evaluation';

function numberEnv(name:string,fallback:number):number {
  const raw=process.env[name];
  if(raw===undefined||raw.trim()==='')return fallback;
  const value=Number(raw);
  if(!Number.isFinite(value)||value<0)throw new Error(`${name} must be a non-negative number.`);
  return value;
}
async function loadRun(path:string):Promise<EvaluationRun>{
  const parsed:unknown=JSON.parse(await readFile(path,'utf8'));
  if(!parsed||typeof parsed!=='object'||!('results' in parsed)||!Array.isArray((parsed as {results:unknown}).results)) {
    throw new Error(`${path} is not a ReasonLens evaluation-run JSON file.`);
  }
  return parsed as EvaluationRun;
}
async function main(){
  const [baselinePath,currentPath]=process.argv.slice(2);
  if(!baselinePath||!currentPath){
    console.error('Usage: npx tsx scripts/check-evaluation-regression.ts <baseline-run.json> <current-run.json>');
    process.exitCode=2;return;
  }
  const config:EvaluationRegressionConfig={
    ...DEFAULT_EVALUATION_REGRESSION_CONFIG,
    maxPassRateDrop:numberEnv('REASONLENS_MAX_PASS_RATE_DROP',0),
    maxProvenanceDrop:numberEnv('REASONLENS_MAX_PROVENANCE_DROP',5),
    maxLatencyIncreasePercent:numberEnv('REASONLENS_MAX_LATENCY_INCREASE_PERCENT',25),
    maxCostIncreasePercent:numberEnv('REASONLENS_MAX_COST_INCREASE_PERCENT',25)
  };
  const report=evaluateEvaluationRegression(await loadRun(baselinePath),await loadRun(currentPath),config);
  console.log(JSON.stringify(report,null,2));
  console.log(`Evaluation regression gate: ${report.status} (${report.failures} failures, ${report.warnings} warnings)`);
  if(report.status==='FAIL')process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=2;});
