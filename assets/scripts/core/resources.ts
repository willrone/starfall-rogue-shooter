import type { ResourceDef, ResourceType, ResourceWallet } from './types';

export const RESOURCE_DEFS: ResourceDef[] = [
    { id: 'alloy', name: '合金', shortName: '合金', color: '#F9C74F' },
    { id: 'cores', name: '核心', shortName: '核心', color: '#F94144' },
    { id: 'shards', name: '装备碎片', shortName: '碎片', color: '#C084FC' },
    { id: 'biomass', name: '生体样本', shortName: '样本', color: '#90BE6D' },
    { id: 'circuits', name: '电路板', shortName: '电路', color: '#4CC9F0' },
    { id: 'crystals', name: '虚空晶体', shortName: '晶体', color: '#B5179E' },
];

export const RESOURCE_ZERO: ResourceWallet = {
    alloy: 0,
    cores: 0,
    shards: 0,
    biomass: 0,
    circuits: 0,
    crystals: 0,
};

export function createEmptyWallet(): ResourceWallet {
    return { ...RESOURCE_ZERO };
}

export function getResourceDef(type: ResourceType): ResourceDef {
    for (const resource of RESOURCE_DEFS) {
        if (resource.id === type) return resource;
    }
    return RESOURCE_DEFS[0];
}

export function formatWallet(wallet: ResourceWallet): string {
    const parts = RESOURCE_DEFS
        .filter((resource) => wallet[resource.id] > 0)
        .map((resource) => `${resource.shortName} ${wallet[resource.id]}`);
    return parts.length > 0 ? parts.join('  ') : '无';
}

export function hasResources(wallet: ResourceWallet, cost: ResourceWallet): boolean {
    for (const resource of RESOURCE_DEFS) {
        if (wallet[resource.id] < cost[resource.id]) return false;
    }
    return true;
}

export function spendResources(wallet: ResourceWallet, cost: ResourceWallet): ResourceWallet | null {
    if (!hasResources(wallet, cost)) return null;
    const next = createEmptyWallet();
    for (const resource of RESOURCE_DEFS) {
        next[resource.id] = wallet[resource.id] - cost[resource.id];
    }
    return next;
}
