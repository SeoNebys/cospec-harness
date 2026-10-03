import { chromium, type Browser } from 'playwright';
let browser:Browser|null=null;
export async function getBrowser(){browser??=await chromium.launch({headless:true});return browser;}
export async function closeBrowser(){await browser?.close();browser=null;}
