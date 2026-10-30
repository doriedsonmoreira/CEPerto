import { cleanText } from "./normalize";

export function isNumberInComplement(complemento: string, userNumber: number): boolean {
    if (!complemento || isNaN(userNumber)) return false;

    const text = cleanText(complemento);
    const isEven = userNumber % 2 === 0;

    if (text.includes("lado impar") && isEven) return false;
    if (text.includes("lado par") && !isEven) return false;

    if (text === "lado impar" && !isEven) return true;
    if (text === "lado par" && isEven) return true;

    const numbersFound = text.match(/\d+/g)?.map(Number) || []

    if (text.includes('ate') && numbersFound.length > 0) {
        const maxLimit = Math.max(...numbersFound)
        return userNumber <= maxLimit
    }

    if (text.includes('ao fim') && numbersFound.length > 0) {
        const minLimit = Math.min(...numbersFound)
        return userNumber >= minLimit
    }

    if (numbersFound.length >= 2) {
        const minLimit = Math.min(...numbersFound)
        const maxLimit = Math.max(...numbersFound)
        return userNumber >= minLimit && userNumber <= maxLimit
    }

    return false
}
