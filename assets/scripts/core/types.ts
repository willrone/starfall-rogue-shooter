export type ResourceType = 'alloy' | 'cores' | 'shards' | 'biomass' | 'circuits' | 'crystals';

export interface ResourceDef {
    id: ResourceType;
    name: string;
    shortName: string;
    color: string;
}

export type ResourceWallet = Record<ResourceType, number>;
