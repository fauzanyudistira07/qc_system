import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { buildFlows } from '../flow-builder/inventory-to-flow.ts';
import { buildBusinessFlowMap } from '../discovery/business-flow.ts';

const root = path.resolve(process.cwd());
const jobsFile = path.join(root, '.qc-artifacts', 'discovery-jobs.json');
const jobId = 'c6784b27-6ef5-4824-be29-c01bf1d5d7b4';
const invFile = path.join(root, '.qc-artifacts', 'jobs', jobId, 'application-inventory.json');

const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
const targetJob = jobs.find((j: any) => j.id === jobId);

if (!targetJob) {
  throw new Error('Job not found!');
}

const inventory = JSON.parse(fs.readFileSync(invFile, 'utf8'));
targetJob.inventory = inventory;
targetJob.flows = buildFlows(inventory, targetJob.config);
targetJob.businessFlowMap = buildBusinessFlowMap(inventory, targetJob.config);
targetJob.status = 'WAITING_REVIEW';
targetJob.phase = 'BUSINESS_FLOW_REVIEW';
targetJob.progress = 88;
targetJob.message = 'Business Flow Map siap direview. Eksekusi menunggu persetujuan reviewer.';
delete targetJob.finishedAt;

fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2), 'utf8');
console.log(`Successfully restored job ${jobId}. Flows count: ${targetJob.flows.length}, Map flows: ${targetJob.businessFlowMap.flows.length}`);
