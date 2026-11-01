export interface ViaCepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  estado?: string;
  regiao?: string;
  unidade?: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
}

export interface StructuredAddress {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export interface ProcessedCepResult extends ViaCepResult {
  isExactMatch?: boolean;
  isUserCity?: boolean;
}
