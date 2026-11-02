export interface ReverseGeocodeResult {
    street: string
    city: string
    uf: string
    neighborhood?: string
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`

    try {
        const response = await fetch(url)
        if (!response.ok) return null

        const data = await response.json()
        const address = data.address

        if (!address) return null

        const street = address.road || address.pedestrian || address.street || ''

        const city = address.city || address.town || address.village || address.municipality || ''

        let uf = ''
        const isoState = address['ISO3166-2-lvl4'] as string | undefined
        if (isoState && isoState.startsWith('BR-')) {
            uf = isoState.replace('BR-', '')
        }

        if (!street || !city || !uf) {
            return null
        }

        return {
            street,
            city,
            uf,
            neighborhood: address.suburb || address.neighbourhood || '',
        }
    } catch (error) {
        console.error('Erro na geocodificação reversa:', error)
        return null
    }
}  
