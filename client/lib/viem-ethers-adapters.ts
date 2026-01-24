import { BrowserProvider, JsonRpcSigner, FallbackProvider, JsonRpcProvider } from 'ethers'
import type { Account, Chain, Client, Transport } from 'viem'

export function clientToSigner(client: Client<Transport, Chain, Account>) {
    const { account, chain, transport } = client
    const network = {
        chainId: chain.id,
        name: chain.name,
        ensAddress: chain.contracts?.ensRegistry?.address,
    }
    const provider = new BrowserProvider(transport, network)
    const signer = new JsonRpcSigner(provider, account.address)
    return signer
}

export function clientToProvider(client: Client<Transport, Chain>) {
    const { chain, transport } = client
    const network = {
        chainId: chain.id,
        name: chain.name,
        ensAddress: chain.contracts?.ensRegistry?.address,
    }
    if (transport.type === 'fallback')
        return new FallbackProvider(
            (transport.transports as ReturnType<Transport>[]).map(
                ({ value }) => new JsonRpcProvider(value?.url, network)
            )
        )
    return new JsonRpcProvider(transport.url, network)
}
