/*
 * Configuração do Nosso Painel
 *
 * Enquanto SUPABASE_URL e SUPABASE_ANON_KEY estiverem vazios, o painel roda em
 * MODO DEMONSTRAÇÃO: os dados ficam só neste navegador (bom para testar).
 *
 * Para usar de verdade (os dois acessando de qualquer lugar), preencha os dois
 * campos abaixo com os dados do seu projeto no Supabase
 * (Project Settings > API). A chave "anon / publishable" PODE ficar aqui:
 * quem protege os dados é o login + as regras do schema.sql.
 * Nunca coloque aqui a chave "service_role".
 */
window.CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Os dois nomes que aparecem no painel (nesta ordem: azul e rosa).
  NOMES: ["Yuri", "Lohrane"],
};
