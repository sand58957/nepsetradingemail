'use client'

// The homepage pricing section, marked as a client component so the server-rendered
// /pricing page can import it: it uses hooks, and only worked on the homepage
// because it was imported from a client wrapper there.
export { default } from '../landing-page/Pricing'
