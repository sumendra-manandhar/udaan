/** Permit guidance. This is NOT legal advice and the rules change: review
 * every item against CAAN and the Ministry of Home Affairs before release,
 * and update REVIEWED_ON when you do. */
export const REVIEWED_ON = 'not yet reviewed against official sources';

export interface PermitStep {
  id: string;
  title: string;
  detail: string;
  link?: { label: string; href: string };
}

export const PERMIT_STEPS: PermitStep[] = [
  {
    id: 'category',
    title: 'Know your weight category',
    detail: 'Nepal groups drones by take-off weight: Category A is under 250 g, B is 250 g to 2 kg, C is 2 to 25 kg, D is over 25 kg.',
  },
  {
    id: 'uin',
    title: 'Register your drone (UIN)',
    detail: 'Every drone needs a Unique Identification Number from the Civil Aviation Authority of Nepal (CAAN). Registration alone does not authorise a flight.',
    link: { label: 'CAAN website', href: 'https://caanepal.gov.np' },
  },
  {
    id: 'district',
    title: 'Get district approval',
    detail: 'Flying a drone up to 2 kg needs prior approval from the District Administration Office where you fly. Heavier drones need higher approvals.',
  },
  {
    id: 'rings',
    title: 'Check airports and restricted areas',
    detail: 'Stay out of the 5 km zone around aerodromes and any restricted or prohibited area. Udaan draws known airport rings, but its list may be incomplete: check current notices too.',
  },
  {
    id: 'limits',
    title: 'Fly within the standard limits',
    detail: 'Fly in daylight and good weather, keep the drone in sight, and keep clear of people, vehicles and buildings. Confirm current height and distance limits with CAAN.',
  },
  {
    id: 'parks',
    title: 'Extra approval in parks and for visitors',
    detail: 'National parks and conservation areas need their own approval. Foreign visitors need approval from several authorities before flying.',
  },
];
