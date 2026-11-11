
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "atendimentos": {
                  Row: {
                    "categoria": Database["public"]['Enums']["categoria_atendimento"],"created_at": string,"created_by": string | null,"data_conclusao": string | null,"data_fechamento": string | null,"data_pagamento": string | null,"data_primeiro_contato": string,"descricao": string | null,"id": string,"numero": number,"observacoes": string | null,"paciente_id": string,"pagamento_detalhe": string | null,"pagamento_forma": Database["public"]['Enums']["forma_pagamento"] | null,"pagamento_status": Database["public"]['Enums']["status_pagamento"],"prazo_entrega": string | null,"status": Database["public"]['Enums']["status_atendimento"],"updated_at": string,"updated_by": string | null,"valor": number,"valor_pago": number
                  }
                  ComputedFields: never
                  Insert: {
                    "categoria"?: Database["public"]['Enums']["categoria_atendimento"],"created_at"?: string,"created_by"?: string | null,"data_conclusao"?: string | null,"data_fechamento"?: string | null,"data_pagamento"?: string | null,"data_primeiro_contato"?: string,"descricao"?: string | null,"id"?: string,"numero"?: never,"observacoes"?: string | null,"paciente_id": string,"pagamento_detalhe"?: string | null,"pagamento_forma"?: Database["public"]['Enums']["forma_pagamento"] | null,"pagamento_status"?: Database["public"]['Enums']["status_pagamento"],"prazo_entrega"?: string | null,"status"?: Database["public"]['Enums']["status_atendimento"],"updated_at"?: string,"updated_by"?: string | null,"valor"?: number,"valor_pago"?: number
                  }
                  Update: {
                    "categoria"?: Database["public"]['Enums']["categoria_atendimento"],"created_at"?: string,"created_by"?: string | null,"data_conclusao"?: string | null,"data_fechamento"?: string | null,"data_pagamento"?: string | null,"data_primeiro_contato"?: string,"descricao"?: string | null,"id"?: string,"numero"?: never,"observacoes"?: string | null,"paciente_id"?: string,"pagamento_detalhe"?: string | null,"pagamento_forma"?: Database["public"]['Enums']["forma_pagamento"] | null,"pagamento_status"?: Database["public"]['Enums']["status_pagamento"],"prazo_entrega"?: string | null,"status"?: Database["public"]['Enums']["status_atendimento"],"updated_at"?: string,"updated_by"?: string | null,"valor"?: number,"valor_pago"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "atendimentos_paciente_id_fkey"
      columns: ["paciente_id"]
isOneToOne: false
      referencedRelation: "pacientes"
      referencedColumns: ["id"]
    }
                  ]
                },"auth_rate_limits": {
                  Row: {
                    "fails": number,"key": string,"locked_until": string | null,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fails"?: number,"key": string,"locked_until"?: string | null,"window_start"?: string
                  }
                  Update: {
                    "fails"?: number,"key"?: string,"locked_until"?: string | null,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"configuracoes": {
                  Row: {
                    "created_at": string,"empresa_cep": string | null,"empresa_cidade": string | null,"empresa_cnpj": string | null,"empresa_email": string | null,"empresa_endereco": string | null,"empresa_nome": string,"empresa_slogan": string | null,"empresa_telefone": string | null,"ficha_especificacoes": string[],"ficha_produtos": string[],"id": boolean,"orc_condicoes_pagamento": string | null,"orc_observacoes": string | null,"orc_prazo_entrega": string | null,"orc_validade_dias": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"empresa_cep"?: string | null,"empresa_cidade"?: string | null,"empresa_cnpj"?: string | null,"empresa_email"?: string | null,"empresa_endereco"?: string | null,"empresa_nome"?: string,"empresa_slogan"?: string | null,"empresa_telefone"?: string | null,"ficha_especificacoes"?: string[],"ficha_produtos"?: string[],"id"?: boolean,"orc_condicoes_pagamento"?: string | null,"orc_observacoes"?: string | null,"orc_prazo_entrega"?: string | null,"orc_validade_dias"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"empresa_cep"?: string | null,"empresa_cidade"?: string | null,"empresa_cnpj"?: string | null,"empresa_email"?: string | null,"empresa_endereco"?: string | null,"empresa_nome"?: string,"empresa_slogan"?: string | null,"empresa_telefone"?: string | null,"ficha_especificacoes"?: string[],"ficha_produtos"?: string[],"id"?: boolean,"orc_condicoes_pagamento"?: string | null,"orc_observacoes"?: string | null,"orc_prazo_entrega"?: string | null,"orc_validade_dias"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: []
                },"fichas_tecnicas": {
                  Row: {
                    "atendimento_id": string,"compensacao_lado": string | null,"compensacao_medida": string | null,"cor_forro": string | null,"cor_tira": string | null,"created_at": string,"created_by": string | null,"especificacoes": (string)[],"id": string,"lateralidade": Database["public"]['Enums']["lateralidade"] | null,"liner": string | null,"medidas_ml": string | null,"nome_na_ortese": boolean,"observacoes": string | null,"produto": string | null,"protese_lado": string | null,"protese_membro": string | null,"protese_nivel": string | null,"tamanho_calcado": string | null,"tamanho_pe": string | null,"tema": string | null,"tipo": Database["public"]['Enums']["tipo_ficha"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "atendimento_id": string,"compensacao_lado"?: string | null,"compensacao_medida"?: string | null,"cor_forro"?: string | null,"cor_tira"?: string | null,"created_at"?: string,"created_by"?: string | null,"especificacoes"?: (string)[],"id"?: string,"lateralidade"?: Database["public"]['Enums']["lateralidade"] | null,"liner"?: string | null,"medidas_ml"?: string | null,"nome_na_ortese"?: boolean,"observacoes"?: string | null,"produto"?: string | null,"protese_lado"?: string | null,"protese_membro"?: string | null,"protese_nivel"?: string | null,"tamanho_calcado"?: string | null,"tamanho_pe"?: string | null,"tema"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_ficha"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "atendimento_id"?: string,"compensacao_lado"?: string | null,"compensacao_medida"?: string | null,"cor_forro"?: string | null,"cor_tira"?: string | null,"created_at"?: string,"created_by"?: string | null,"especificacoes"?: (string)[],"id"?: string,"lateralidade"?: Database["public"]['Enums']["lateralidade"] | null,"liner"?: string | null,"medidas_ml"?: string | null,"nome_na_ortese"?: boolean,"observacoes"?: string | null,"produto"?: string | null,"protese_lado"?: string | null,"protese_membro"?: string | null,"protese_nivel"?: string | null,"tamanho_calcado"?: string | null,"tamanho_pe"?: string | null,"tema"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_ficha"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fichas_tecnicas_atendimento_id_fkey"
      columns: ["atendimento_id"]
isOneToOne: true
      referencedRelation: "atendimentos"
      referencedColumns: ["id"]
    }
                  ]
                },"historico_precos": {
                  Row: {
                    "alterado_em": string,"alterado_por": string | null,"id": string,"origem": string,"preco_anterior": number | null,"preco_novo": number,"produto_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alterado_em"?: string,"alterado_por"?: string | null,"id"?: string,"origem"?: string,"preco_anterior"?: number | null,"preco_novo": number,"produto_id": string
                  }
                  Update: {
                    "alterado_em"?: string,"alterado_por"?: string | null,"id"?: string,"origem"?: string,"preco_anterior"?: number | null,"preco_novo"?: number,"produto_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "historico_precos_produto_id_fkey"
      columns: ["produto_id"]
isOneToOne: false
      referencedRelation: "produtos"
      referencedColumns: ["id"]
    }
                  ]
                },"orcamento_itens": {
                  Row: {
                    "descricao": string,"detalhe": string | null,"id": string,"orcamento_id": string,"ordem": number,"preco_unitario": number,"produto_id": string | null,"quantidade": number,"secao": string | null,"tipo": Database["public"]['Enums']["tipo_produto"],"total": number,"unidade": string
                  }
                  ComputedFields: never
                  Insert: {
                    "descricao": string,"detalhe"?: string | null,"id"?: string,"orcamento_id": string,"ordem": number,"preco_unitario": number,"produto_id"?: string | null,"quantidade": number,"secao"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_produto"],"total"?: never,"unidade"?: string
                  }
                  Update: {
                    "descricao"?: string,"detalhe"?: string | null,"id"?: string,"orcamento_id"?: string,"ordem"?: number,"preco_unitario"?: number,"produto_id"?: string | null,"quantidade"?: number,"secao"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_produto"],"total"?: never,"unidade"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orcamento_itens_orcamento_id_fkey"
      columns: ["orcamento_id"]
isOneToOne: false
      referencedRelation: "orcamentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orcamento_itens_produto_id_fkey"
      columns: ["produto_id"]
isOneToOne: false
      referencedRelation: "produtos"
      referencedColumns: ["id"]
    }
                  ]
                },"orcamentos": {
                  Row: {
                    "ano": number,"aprovado_em": string | null,"atendimento_id": string | null,"condicoes_pagamento": string | null,"created_at": string,"created_by": string | null,"data_emissao": string,"desconto": number,"desconto_tipo": Database["public"]['Enums']["tipo_desconto"],"desconto_valor": number,"enviado_em": string | null,"id": string,"numero": string,"observacoes": string | null,"paciente_id": string,"prazo_entrega": string | null,"sequencial": number,"status": Database["public"]['Enums']["status_orcamento"],"subtotal": number,"total": number,"updated_at": string,"updated_by": string | null,"validade": string,"versao": number,"versao_anterior_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ano": number,"aprovado_em"?: string | null,"atendimento_id"?: string | null,"condicoes_pagamento"?: string | null,"created_at"?: string,"created_by"?: string | null,"data_emissao"?: string,"desconto"?: number,"desconto_tipo"?: Database["public"]['Enums']["tipo_desconto"],"desconto_valor"?: number,"enviado_em"?: string | null,"id"?: string,"numero"?: never,"observacoes"?: string | null,"paciente_id": string,"prazo_entrega"?: string | null,"sequencial": number,"status"?: Database["public"]['Enums']["status_orcamento"],"subtotal"?: number,"total"?: number,"updated_at"?: string,"updated_by"?: string | null,"validade": string,"versao"?: number,"versao_anterior_id"?: string | null
                  }
                  Update: {
                    "ano"?: number,"aprovado_em"?: string | null,"atendimento_id"?: string | null,"condicoes_pagamento"?: string | null,"created_at"?: string,"created_by"?: string | null,"data_emissao"?: string,"desconto"?: number,"desconto_tipo"?: Database["public"]['Enums']["tipo_desconto"],"desconto_valor"?: number,"enviado_em"?: string | null,"id"?: string,"numero"?: never,"observacoes"?: string | null,"paciente_id"?: string,"prazo_entrega"?: string | null,"sequencial"?: number,"status"?: Database["public"]['Enums']["status_orcamento"],"subtotal"?: number,"total"?: number,"updated_at"?: string,"updated_by"?: string | null,"validade"?: string,"versao"?: number,"versao_anterior_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "orcamentos_atendimento_id_fkey"
      columns: ["atendimento_id"]
isOneToOne: false
      referencedRelation: "atendimentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orcamentos_paciente_id_fkey"
      columns: ["paciente_id"]
isOneToOne: false
      referencedRelation: "pacientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orcamentos_versao_anterior_id_fkey"
      columns: ["versao_anterior_id"]
isOneToOne: false
      referencedRelation: "orcamentos"
      referencedColumns: ["id"]
    }
                  ]
                },"pacientes": {
                  Row: {
                    "cidade": string | null,"consentimento_lgpd_em": string,"consentimento_por": string | null,"cpf": string | null,"created_at": string,"created_by": string | null,"data_nascimento": string | null,"diagnostico": string | null,"endereco": string | null,"id": string,"medico": string | null,"nome": string,"nome_busca": string | null,"observacoes": string | null,"origem": Database["public"]['Enums']["origem_paciente"],"origem_nome": string | null,"telefone": string | null,"uf": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cidade"?: string | null,"consentimento_lgpd_em": string,"consentimento_por"?: string | null,"cpf"?: string | null,"created_at"?: string,"created_by"?: string | null,"data_nascimento"?: string | null,"diagnostico"?: string | null,"endereco"?: string | null,"id"?: string,"medico"?: string | null,"nome": string,"nome_busca"?: never,"observacoes"?: string | null,"origem"?: Database["public"]['Enums']["origem_paciente"],"origem_nome"?: string | null,"telefone"?: string | null,"uf"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cidade"?: string | null,"consentimento_lgpd_em"?: string,"consentimento_por"?: string | null,"cpf"?: string | null,"created_at"?: string,"created_by"?: string | null,"data_nascimento"?: string | null,"diagnostico"?: string | null,"endereco"?: string | null,"id"?: string,"medico"?: string | null,"nome"?: string,"nome_busca"?: never,"observacoes"?: string | null,"origem"?: Database["public"]['Enums']["origem_paciente"],"origem_nome"?: string | null,"telefone"?: string | null,"uf"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"produtos": {
                  Row: {
                    "ativo": boolean,"categoria": string | null,"codigo": string | null,"created_at": string,"created_by": string | null,"descricao": string | null,"id": string,"nome": string,"nome_busca": string | null,"preco": number,"tipo": Database["public"]['Enums']["tipo_produto"],"unidade": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"categoria"?: string | null,"codigo"?: string | null,"created_at"?: string,"created_by"?: string | null,"descricao"?: string | null,"id"?: string,"nome": string,"nome_busca"?: never,"preco"?: number,"tipo"?: Database["public"]['Enums']["tipo_produto"],"unidade"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "ativo"?: boolean,"categoria"?: string | null,"codigo"?: string | null,"created_at"?: string,"created_by"?: string | null,"descricao"?: string | null,"id"?: string,"nome"?: string,"nome_busca"?: never,"preco"?: number,"tipo"?: Database["public"]['Enums']["tipo_produto"],"unidade"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"responsaveis": {
                  Row: {
                    "cpf": string | null,"created_at": string,"created_by": string | null,"id": string,"nome": string,"paciente_id": string,"parentesco": string | null,"principal": boolean,"telefone": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cpf"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"nome": string,"paciente_id": string,"parentesco"?: string | null,"principal"?: boolean,"telefone"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cpf"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"nome"?: string,"paciente_id"?: string,"parentesco"?: string | null,"principal"?: boolean,"telefone"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "responsaveis_paciente_id_fkey"
      columns: ["paciente_id"]
isOneToOne: false
      referencedRelation: "pacientes"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "auth_rate_check":
{ Args: { "p_key": string }; Returns: number
                           },
"auth_rate_fail":
{ Args: { "p_key": string,"p_lock_sec": number,"p_max": number,"p_window_sec": number }; Returns: undefined
                           },
"auth_rate_gc":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"auth_rate_reset":
{ Args: { "p_key": string }; Returns: undefined
                           },
"buscar_pacientes":
{ Args: { "lim"?: number,"pular"?: number,"q"?: string }; Returns: {
              "cidade": string,"cpf_mascarado": string,"created_at": string,"data_nascimento": string,"id": string,"nome": string,"origem": Database["public"]['Enums']["origem_paciente"],"origem_nome": string,"responsavel": string,"telefone": string,"total": number,"uf": string
            }[]
                           },
"cpf_valido":
{ Args: { "c": string }; Returns: boolean
                           },
"f_unaccent":
{ Args: { "t": string }; Returns: string
                           },
"importar_produtos":
{ Args: { "p_itens": Json }; Returns: Json
                           },
"aprovar_orcamento":
{ Args: { "p_hoje": string,"p_id": string }; Returns: string
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mascarar_cpf":
{ Args: { "c": string }; Returns: string
                           },
"mudar_status_orcamento":
{ Args: { "p_id": string,"p_status": Database["public"]['Enums']["status_orcamento"] }; Returns: undefined
                           },
"nova_versao_orcamento":
{ Args: { "p_hoje": string,"p_id": string }; Returns: string
                           },
"painel_resumo":
{ Args: { "p_hoje": string }; Returns: Json
                           },
"salvar_atendimento":
{ Args: { "p_dados": Json,"p_ficha"?: Json,"p_id": string }; Returns: string
                           },
"salvar_orcamento":
{ Args: { "p_dados": Json,"p_id": string,"p_itens": Json }; Returns: string
                           },
"salvar_paciente":
{ Args: { "p_dados": Json,"p_id": string,"p_responsaveis"?: Json }; Returns: string
                           }
          }
          Enums: {
            "categoria_atendimento": "confeccao"|"ajuste"|"reparo"|"manutencao","forma_pagamento": "pix"|"dinheiro"|"cartao"|"boleto"|"convenio","lateralidade": "bilateral"|"unilateral_d"|"unilateral_e","origem_paciente": "clinica"|"particular"|"plano","status_atendimento": "em_contato"|"em_producao"|"pronto"|"entregue"|"cancelado","status_pagamento": "pendente"|"parcial"|"pago"|"isento","tipo_ficha": "ortese"|"protese"|"palmilha","tipo_produto": "base"|"adicional","status_orcamento": "rascunho"|"enviado"|"aprovado"|"recusado"|"substituido","tipo_desconto": "valor"|"percentual"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "categoria_atendimento": ["confeccao", "ajuste", "reparo", "manutencao"],"forma_pagamento": ["pix", "dinheiro", "cartao", "boleto", "convenio"],"lateralidade": ["bilateral", "unilateral_d", "unilateral_e"],"origem_paciente": ["clinica", "particular", "plano"],"status_atendimento": ["em_contato", "em_producao", "pronto", "entregue", "cancelado"],"status_pagamento": ["pendente", "parcial", "pago", "isento"],"tipo_ficha": ["ortese", "protese", "palmilha"]
          }
        }
} as const
