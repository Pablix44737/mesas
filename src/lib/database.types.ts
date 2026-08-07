// Generado desde el proyecto Supabase `mesas`.
// Regenerar tras cada migración: mantiene tipadas las consultas y las relaciones
// (sin esto, un embed a-uno se infiere como array).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	__InternalSupabase: {
		PostgrestVersion: '14.15';
	};
	public: {
		Tables: {
			checklist_items: {
				Row: {
					id: string;
					orden: number;
					peso: number;
					plantilla_id: string;
					texto: string;
				};
				Insert: {
					id?: string;
					orden: number;
					peso?: number;
					plantilla_id: string;
					texto: string;
				};
				Update: {
					id?: string;
					orden?: number;
					peso?: number;
					plantilla_id?: string;
					texto?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'checklist_items_plantilla_id_fkey';
						columns: ['plantilla_id'];
						isOneToOne: false;
						referencedRelation: 'checklist_plantillas';
						referencedColumns: ['id'];
					}
				];
			};
			checklist_instancias: {
				Row: {
					creada_en: string;
					enviada_en: string | null;
					id: string;
					participacion_id: string;
					plantilla_id: string;
				};
				Insert: {
					creada_en?: string;
					enviada_en?: string | null;
					id?: string;
					participacion_id: string;
					plantilla_id: string;
				};
				Update: {
					creada_en?: string;
					enviada_en?: string | null;
					id?: string;
					participacion_id?: string;
					plantilla_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'checklist_instancias_participacion_id_fkey';
						columns: ['participacion_id'];
						isOneToOne: true;
						referencedRelation: 'participaciones';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'checklist_instancias_plantilla_id_fkey';
						columns: ['plantilla_id'];
						isOneToOne: false;
						referencedRelation: 'checklist_plantillas';
						referencedColumns: ['id'];
					}
				];
			};
			checklist_respuestas: {
				Row: {
					cumplido: boolean;
					id: string;
					instancia_id: string;
					item_id: string;
					marcada_en: string;
				};
				Insert: {
					cumplido?: boolean;
					id?: string;
					instancia_id: string;
					item_id: string;
					marcada_en?: string;
				};
				Update: {
					cumplido?: boolean;
					id?: string;
					instancia_id?: string;
					item_id?: string;
					marcada_en?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'checklist_respuestas_instancia_id_fkey';
						columns: ['instancia_id'];
						isOneToOne: false;
						referencedRelation: 'checklist_instancias';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'checklist_respuestas_item_id_fkey';
						columns: ['item_id'];
						isOneToOne: false;
						referencedRelation: 'checklist_items';
						referencedColumns: ['id'];
					}
				];
			};
			checklist_plantillas: {
				Row: {
					creada_en: string;
					estado: string;
					id: string;
					nombre: string;
					ponderado: boolean;
					rol_codigo: string;
				};
				Insert: {
					creada_en?: string;
					estado?: string;
					id?: string;
					nombre: string;
					ponderado?: boolean;
					rol_codigo: string;
				};
				Update: {
					creada_en?: string;
					estado?: string;
					id?: string;
					nombre?: string;
					ponderado?: boolean;
					rol_codigo?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'checklist_plantillas_rol_codigo_fkey';
						columns: ['rol_codigo'];
						isOneToOne: false;
						referencedRelation: 'roles';
						referencedColumns: ['codigo'];
					}
				];
			};
			corridas: {
				Row: {
					creada_en: string;
					habilitada: boolean;
					id: string;
					mesa_id: string;
					numero: number;
				};
				Insert: {
					creada_en?: string;
					habilitada?: boolean;
					id?: string;
					mesa_id: string;
					numero: number;
				};
				Update: {
					creada_en?: string;
					habilitada?: boolean;
					id?: string;
					mesa_id?: string;
					numero?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'corridas_mesa_id_fkey';
						columns: ['mesa_id'];
						isOneToOne: false;
						referencedRelation: 'mesas';
						referencedColumns: ['id'];
					}
				];
			};
			escenarios: {
				Row: {
					checklist_tecnica_id: string | null;
					creado_en: string;
					disponible: boolean;
					id: string;
					nombre: string;
					planificacion_archivo: string | null;
					planificacion_ruta: string | null;
					planificacion_subida_en: string | null;
					planificacion_tamano: number | null;
					planificacion_tipo: string | null;
				};
				Insert: {
					checklist_tecnica_id?: string | null;
					creado_en?: string;
					disponible?: boolean;
					id?: string;
					nombre: string;
					planificacion_archivo?: string | null;
					planificacion_ruta?: string | null;
					planificacion_subida_en?: string | null;
					planificacion_tamano?: number | null;
					planificacion_tipo?: string | null;
				};
				Update: {
					checklist_tecnica_id?: string | null;
					creado_en?: string;
					disponible?: boolean;
					id?: string;
					nombre?: string;
					planificacion_archivo?: string | null;
					planificacion_ruta?: string | null;
					planificacion_subida_en?: string | null;
					planificacion_tamano?: number | null;
					planificacion_tipo?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'escenarios_checklist_tecnica_id_fkey';
						columns: ['checklist_tecnica_id'];
						isOneToOne: false;
						referencedRelation: 'checklist_plantillas';
						referencedColumns: ['id'];
					}
				];
			};
			mesas: {
				Row: {
					creada_en: string;
					escenario_id: string;
					id: string;
					numero: number;
				};
				Insert: {
					creada_en?: string;
					escenario_id: string;
					id?: string;
					numero: number;
				};
				Update: {
					creada_en?: string;
					escenario_id?: string;
					id?: string;
					numero?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'mesas_escenario_id_fkey';
						columns: ['escenario_id'];
						isOneToOne: false;
						referencedRelation: 'escenarios';
						referencedColumns: ['id'];
					}
				];
			};
			participaciones: {
				Row: {
					corrida_id: string;
					creada_en: string;
					dni: string;
					id: string;
					participante_id: string | null;
					rol_codigo: string;
				};
				Insert: {
					corrida_id: string;
					creada_en?: string;
					dni: string;
					id?: string;
					participante_id?: string | null;
					rol_codigo: string;
				};
				Update: {
					corrida_id?: string;
					creada_en?: string;
					dni?: string;
					id?: string;
					participante_id?: string | null;
					rol_codigo?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'participaciones_corrida_id_fkey';
						columns: ['corrida_id'];
						isOneToOne: false;
						referencedRelation: 'corridas';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'participaciones_participante_id_fkey';
						columns: ['participante_id'];
						isOneToOne: false;
						referencedRelation: 'participantes';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'participaciones_rol_codigo_fkey';
						columns: ['rol_codigo'];
						isOneToOne: false;
						referencedRelation: 'roles';
						referencedColumns: ['codigo'];
					}
				];
			};
			participantes: {
				Row: {
					apellido: string;
					creado_en: string;
					dni: string;
					id: string;
					nombre: string;
				};
				Insert: {
					apellido: string;
					creado_en?: string;
					dni: string;
					id?: string;
					nombre: string;
				};
				Update: {
					apellido?: string;
					creado_en?: string;
					dni?: string;
					id?: string;
					nombre?: string;
				};
				Relationships: [];
			};
			roles: {
				Row: {
					codigo: string;
					creado_en: string;
					id: string;
					nombre: string;
					observador: boolean;
					orden: number;
				};
				Insert: {
					codigo: string;
					creado_en?: string;
					id?: string;
					nombre: string;
					observador?: boolean;
					orden?: number;
				};
				Update: {
					codigo?: string;
					creado_en?: string;
					id?: string;
					nombre?: string;
					observador?: boolean;
					orden?: number;
				};
				Relationships: [];
			};
		};
		Views: {
			checklists_sin_enviar: {
				Row: {
					checklist: string | null;
					corrida_habilitada: boolean | null;
					corrida_id: string | null;
					corrida_numero: number | null;
					creada_en: string | null;
					dni: string | null;
					instancia_id: string | null;
					items: number | null;
					marcados: number | null;
					mesa_id: string | null;
					mesa_numero: number | null;
					participacion_id: string | null;
					participante_id: string | null;
					participante_nombre: string | null;
					rol_codigo: string | null;
					rol_nombre: string | null;
				};
				Relationships: [];
			};
			evaluaciones_enviadas: {
				Row: {
					checklist: string | null;
					corrida_id: string | null;
					corrida_numero: number | null;
					enviada_en: string | null;
					instancia_id: string | null;
					items: number | null;
					items_cumplidos: number | null;
					maximo: number | null;
					mesa_id: string | null;
					mesa_numero: number | null;
					observador_dni: string | null;
					observador_nombre: string | null;
					observador_participante_id: string | null;
					participacion_id: string | null;
					plantilla_id: string | null;
					ponderado: boolean | null;
					resultado: number | null;
					rol_codigo: string | null;
					rol_nombre: string | null;
					rol_orden: number | null;
				};
				Relationships: [];
			};
			participaciones_sin_resolver: {
				Row: {
					corrida_id: string | null;
					corrida_numero: number | null;
					creada_en: string | null;
					dni: string | null;
					mesa_id: string | null;
					mesa_numero: number | null;
					participacion_id: string | null;
					rol_codigo: string | null;
					rol_nombre: string | null;
					rol_orden: number | null;
				};
				Relationships: [];
			};
			resultados_de_evaluacion: {
				Row: {
					checklist: string | null;
					enviada_en: string | null;
					instancia_id: string | null;
					items: number | null;
					items_cumplidos: number | null;
					maximo: number | null;
					participacion_id: string | null;
					plantilla_id: string | null;
					ponderado: boolean | null;
					resultado: number | null;
				};
				Relationships: [];
			};
		};
		Functions: {
			abrir_instancia_de_checklist: {
				Args: { p_participacion_id: string };
				Returns: {
					creada_en: string;
					enviada_en: string | null;
					id: string;
					participacion_id: string;
					plantilla_id: string;
				};
				SetofOptions: {
					from: '*';
					to: 'checklist_instancias';
					isOneToOne: true;
					isSetofReturn: false;
				};
			};
			dar_por_terminado_el_checklist: {
				Args: { p_plantilla_id: string };
				Returns: {
					creada_en: string;
					estado: string;
					id: string;
					nombre: string;
					ponderado: boolean;
					rol_codigo: string;
				};
				SetofOptions: {
					from: '*';
					to: 'checklist_plantillas';
					isOneToOne: true;
					isSetofReturn: false;
				};
			};
			plantilla_de_la_participacion: {
				Args: { p_participacion_id: string };
				Returns: string;
			};
			habilitar_siguiente_corrida: {
				Args: { p_mesa_id: string };
				Returns: {
					creada_en: string;
					habilitada: boolean;
					id: string;
					mesa_id: string;
					numero: number;
				};
				SetofOptions: {
					from: '*';
					to: 'corridas';
					isOneToOne: true;
					isSetofReturn: false;
				};
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};
