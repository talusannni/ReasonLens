import './globals.css';
import type { Metadata } from 'next';
export const metadata:Metadata={title:'ReasonLens — AI Reasoning & Evidence Explorer',description:'Open-source visual debugger for AI reasoning, evidence and execution.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
