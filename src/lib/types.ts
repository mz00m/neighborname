export interface Property {
  parcelId: string;
  houseNumber: string;
  street: string;
  city: string;
  zip: string;
  fullAddress: string;
  lat: number;
  lng: number;
  yearBuilt?: number;
  style?: string;
  bedrooms?: number;
  bathrooms?: number;
  stories?: string;
  livingArea?: number;
  lotArea?: number;
  lastSalePrice?: number;
  lastSaleDate?: string;
  propertyClass?: string;
  condition?: string;
}

export interface Neighbor {
  id: string;
  property: Property;
  name: string;
  isOwner: boolean | null;
  notes: string;
  tags: string[];
  met: boolean;
  photo?: string;
  email?: string;
  phone?: string;
  addedAt: string;
}

export interface NeighborhoodData {
  myAddress: string;
  myParcelId: string;
  center: [number, number];
  neighbors: Neighbor[];
  setupAt: string;
  lastUpdated: string;
}

export interface GeocodeResult {
  parcelId: string;
  lat: number;
  lng: number;
  neighborhood?: string;
  municipality?: string;
  municode?: string;
}

export interface WPRDCAssessment {
  PARID: string;
  PROPERTYHOUSENUM: string;
  PROPERTYADDRESS: string;
  PROPERTYCITY: string;
  PROPERTYZIP: string;
  MUNICODE: string;
  MUNIDESC: string;
  YEARBLT: number | null;
  STYLEDESC: string | null;
  BEDROOMS: number | null;
  FULLBATHS: number | null;
  HALFBATHS: number | null;
  STORIES: string | null;
  FINISHEDLIVINGAREA: number | null;
  LOTAREA: number | null;
  SALEPRICE: number | null;
  SALEDATE: string | null;
  CLASSDESC: string | null;
  CONDITIONDESC: string | null;
  USEDESC: string | null;
}
