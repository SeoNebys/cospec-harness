export type MetricSnapshot={requests:number;capturesCompleted:number;capturesFailed:number;imports:number};
const metrics:MetricSnapshot={requests:0,capturesCompleted:0,capturesFailed:0,imports:0};
export const increment=(key:keyof MetricSnapshot)=>{metrics[key]++};
export const metricSnapshot=()=>({...metrics});
