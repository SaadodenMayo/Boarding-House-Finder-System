import { API_BASE_URL } from './config';
let token:string|null=null;
export const setToken=(v:string|null)=>{token=v;};
export async function api<T>(path:string, options:RequestInit={}) : Promise<T> {
 const headers:Record<string,string>={'Content-Type':'application/json',...(options.headers as any||{})};
 if(token) headers.Authorization=`Bearer ${token}`;
 let response:Response;
 try { response=await fetch(`${API_BASE_URL}${path}`,{...options,headers}); }
 catch { throw new Error('Cannot reach the server. Check API_BASE_URL and make sure your phone and computer use the same Wi-Fi.'); }
 const data=await response.json().catch(()=>({}));
 if(!response.ok) throw new Error(data.error||`Request failed (${response.status})`);
 return data as T;
}
