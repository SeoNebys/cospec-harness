import type { ReactNode } from 'react';
export function AsyncState({loading,error,children}:{loading:boolean;error:string;children:ReactNode}){if(loading)return <div className="state" role="status"><span className="spinner"/>Loading your bookmarks…</div>;if(error)return <div className="state error" role="alert"><strong>Something went wrong</strong><p>{error}</p></div>;return <>{children}</>}
