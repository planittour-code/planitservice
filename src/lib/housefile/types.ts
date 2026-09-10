export type Company = {
  id: string;
  user_id: string;
  name: string;
  trade: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_src: string | null;
  agreement: string | null;
  terms: string | null;
  trades: string | null;
  onboarded_at: string | null;
  shop_paid_at: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  years_in_business: number | null;
  associations: string | null;
  review_google: string | null;
  review_trustpilot: string | null;
  review_nextdoor: string | null;
  review_other: string | null;
  payment_terms: string | null;
  payment_link: string | null;
  kits_seeded_at: string | null;
  slug: string | null;
  created_at: string;
};

export type ShopRole = "owner" | "sales";

export type CompanyMember = {
  id: string;
  company_id: string;
  user_id: string | null;
  email: string;
  role: ShopRole;
  created_at: string;
};

export type Property = {
  id: string;
  company_id: string;
  share_token: string;
  invite_token: string;
  invite_status: "pending" | "sent" | "claimed";
  address_line: string;
  city: string;
  state: string;
  zip: string;
  homeowner_name: string;
  homeowner_email: string;
  homeowner_phone: string | null;
  homeowner_user_id: string | null;
  notes: string | null;
  created_at: string;
};

export type PropertyFact = {
  id: string;
  property_id: string;
  field_key: string;
  value: string;
  source: "contractor" | "homeowner";
  updated_at: string;
};

export type PropertyPhoto = {
  id: string;
  property_id: string;
  src: string;
  caption: string | null;
  category: string;
  uploaded_by: "contractor" | "homeowner";
  created_at: string;
};

export type Template = {
  id: string;
  company_id: string | null;
  name: string;
  trade: string;
  description: string;
  cover_note: string;
};

export type TemplateItem = {
  id: string;
  template_id: string;
  sort_order: number;
  name: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  optional: boolean;
  category: string | null;
  manufacturer: string | null;
  product_name: string | null;
  sku: string | null;
  color: string | null;
  warranty_years: number | null;
  warranty_terms: string | null;
};

export type ProposalStatus = "draft" | "pending" | "sent" | "revised" | "accepted" | "completed";

export type Proposal = {
  id: string;
  company_id: string;
  property_id: string;
  template_id: string | null;
  share_token: string;
  title: string;
  status: ProposalStatus;
  cover_note: string | null;
  cover_photo_src?: string | null;
  created_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  created_by: string | null;
};

export type ProposalItem = {
  id: string;
  proposal_id: string;
  sort_order: number;
  name: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  unit_cost: number | null;
  included: boolean;
  optional: boolean;
  category: string | null;
  manufacturer: string | null;
  product_name: string | null;
  sku: string | null;
  color: string | null;
  location_note: string | null;
  warranty_years: number | null;
  warranty_terms: string | null;
  homeowner_note: string | null;
  option_id?: string | null;
  review_status?: string | null;
};

export type ProposalMessage = {
  id: string;
  proposal_id: string;
  author_role: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type Job = {
  id: string;
  company_id: string;
  property_id: string;
  proposal_id: string | null;
  title: string;
  summary: string | null;
  completed_at: string;
  created_at: string;
};

export type JobSpec = {
  id: string;
  job_id: string;
  kind: string;
  label: string;
  value: string;
  location_note: string | null;
  manufacturer: string | null;
  product_name: string | null;
  warranty_years: number | null;
  warranty_terms: string | null;
  warranty_expires: string | null;
};

export type JobWithSpecs = Job & { specs: JobSpec[] };

export type PropertyListRow = Property & {
  fact_count: number;
  photo_count: number;
  job_count: number;
  open_proposal_count: number;
  cover_src: string | null;
};

export type ProposalListRow = Proposal & {
  address_line: string;
  homeowner_name: string;
  template_name?: string | null;
  template_trade?: string | null;
};

export type ShopWorkRow = {
  id: string;
  kind: "proposal" | "job" | "invite";
  title: string;
  status: string;
  summary: string | null;
  property_id: string;
  proposal_id: string | null;
  invite_token: string | null;
  address_line: string;
  city: string;
  state: string;
  zip: string;
  homeowner_name: string;
  homeowner_email: string;
  homeowner_phone: string | null;
  created_at: string;
  completed_at: string | null;
};

export type ShopClientRow = {
  key: string;
  name: string;
  email: string;
  phone: string | null;
  houseCount: number;
  jobCount: number;
  openCount: number;
  houses: {
    id: string;
    address_line: string;
    city: string;
    state: string;
    zip: string;
  }[];
};

export type HouseCompany = {
  id: string;
  name: string;
  trade: string;
  phone: string | null;
  email: string | null;
  logo_src: string | null;
  agreement: string | null;
  terms: string | null;
  payment_terms: string | null;
  payment_link: string | null;
};

export type HouseFile = {
  property: Property;
  company: HouseCompany;
  facts: PropertyFact[];
  photos: PropertyPhoto[];
  jobs: JobWithSpecs[];
  proposals: ProposalListRow[];
  filledCount: number;
  totalCount: number;
};

export type ProposalBundle = {
  proposal: Proposal;
  items: ProposalItem[];
  messages: ProposalMessage[];
  property: Property;
  company: HouseCompany;
  house: HouseFile;
};

export type HomeownerHouse = PropertyListRow & {
  company_name: string;
  open_title: string | null;
  open_token: string | null;
  plan?: PropertyPlan | null;
  dueSoon?: number;
};

export type AddressTease = {
  found: boolean;
  owned: boolean;
  propertyId: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  photo: string | null;
  facts: { key: string; label: string; value: string }[];
  jobs: { title: string; year: string }[];
  factCount?: number;
  totalCount?: number;
};

export type HomeownerPlan = "basic" | "plus";

export type HomeownerProfile = {
  user_id: string;
  plan: HomeownerPlan;
  status: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
};

export type Portfolio = {
  id: string;
  user_id: string;
  name: string;
  paid_at: string | null;
  extra_slots: number;
  extra_seats: number;
  included_count: number;
  phone: string | null;
  email: string | null;
  logo_src: string | null;
  created_at: string;
};

export type PortfolioRole = "owner" | "staff";

export type PortfolioMember = {
  id: string;
  portfolio_id: string;
  user_id: string | null;
  email: string;
  role: PortfolioRole;
  created_at: string;
};

export type FileWorkInvite = {
  id: string;
  property_id: string;
  invited_by_user_id: string;
  shop_email: string;
  shop_name: string | null;
  title: string;
  body: string;
  share_token: string;
  status: "open" | "quoted" | "closed";
  created_at: string;
};

export type RfpStatus = "open" | "awarded" | "closed";

export type Rfp = {
  id: string;
  share_token: string;
  user_id: string;
  property_id: string | null;
  work_id: string;
  title: string;
  body: string;
  budget: string | null;
  address_line: string;
  city: string;
  state: string;
  zip: string;
  homeowner_name: string;
  status: RfpStatus;
  created_at: string;
};

export type RfpQuote = {
  id: string;
  rfp_id: string;
  company_id: string;
  proposal_id: string;
  created_at: string;
  company_name: string;
  proposal_title: string;
  proposal_token: string;
  proposal_status: string;
};

export type PlanCadence = "monthly" | "annual";
export type PlanTier = "standard" | "pro";

export type PropertyPlan = {
  property_id: string;
  cadence: PlanCadence;
  tier: PlanTier;
  status: string;
  renews_on: string;
};

export type MaintenanceTask = {
  id: string;
  property_id: string;
  title: string;
  system_name: string;
  cadence: string;
  due_on: string;
  completed_at: string | null;
  notes: string | null;
  scheduled_on: string | null;
  scheduled_note: string | null;
};

export type MaintenanceStatus = "scheduled" | "overdue" | "dueSoon" | "current";

export type PortfolioNextTask = {
  id: string;
  title: string;
  due_on: string;
  scheduled_on: string | null;
  status: MaintenanceStatus;
  kind?: "maintenance" | "estimate";
};

export type PortfolioAcceptedEstimate = {
  id: string;
  property_id: string;
  title: string;
  share_token: string;
  accepted_at: string;
  company_name: string;
  address_line: string;
  city: string;
  state: string;
  zip: string;
  homeowner_name: string;
};

export type PortfolioHouse = HomeownerHouse & {
  status: MaintenanceStatus;
  overdueCount: number;
  dueSoonCount: number;
  scheduledCount: number;
  nextTask: PortfolioNextTask | null;
  acceptedEstimates: PortfolioAcceptedEstimate[];
};

export type PortfolioOwner = {
  key: string;
  name: string;
  email: string;
  houseCount: number;
  jobCount: number;
  overdueCount: number;
  dueSoonCount: number;
  scheduledCount: number;
  houses: PortfolioHouse[];
};

export type PortfolioUpcoming = {
  id: string;
  property_id: string;
  title: string;
  system_name: string;
  due_on: string;
  scheduled_on: string | null;
  scheduled_note: string | null;
  status: MaintenanceStatus;
  address_line: string;
  city: string;
  state: string;
  zip: string;
  homeowner_name: string;
  kind?: "maintenance" | "estimate";
  share_token?: string | null;
};

export type PropertyTransfer = {
  id: string;
  property_id: string;
  from_user_id: string;
  to_email: string;
  reason: string;
  token: string;
  status: string;
  created_at: string;
};


