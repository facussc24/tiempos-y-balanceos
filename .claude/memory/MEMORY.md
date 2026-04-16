# Memory Index

## Operacional — Reglas de comportamiento (cada sesion)

- [feedback_backup.md](feedback_backup.md) — Backup obligatorio al final de cada sesion
- [../rules/git-deploy.md](../rules/git-deploy.md) — OBLIGATORIO npm run build + git push (regla durable en rules/)
- [feedback_git_sync_2pcs.md](feedback_git_sync_2pcs.md) — OBLIGATORIO git pull al inicio — Fak usa 2 PCs
- [feedback_automation_system.md](feedback_automation_system.md) — Hooks + agente auditor + reglas. Lanzar auditor AL FINAL de cada tarea
- [feedback_ask_before_acting.md](feedback_ask_before_acting.md) — PREGUNTAR antes de actuar sin info suficiente
- [feedback_no_flag_aph_actions.md](feedback_no_flag_aph_actions.md) — NO reportar AP=H sin acciones como problema
- [feedback_no_assign_ccsc.md](feedback_no_assign_ccsc.md) — NO asignar CC/SC sin autorizacion explicita de Fak
- [feedback_no_english_no_invent.md](feedback_no_english_no_invent.md) — CERO ingles en APQP. NO inventar contenido tecnico
- [feedback_6m_completeness.md](feedback_6m_completeness.md) — Verificar completitud 6M al importar AMFEs
- [feedback_masters_vs_families.md](feedback_masters_vs_families.md) — Maestros = procesos vs familias = productos. No mezclar
- [feedback_cp_ho_manual.md](feedback_cp_ho_manual.md) — CP y HO se regeneran MANUALMENTE, nunca automatico
- [feedback_amfe_data_is_text.md](feedback_amfe_data_is_text.md) — amfe/cp documents.data son TEXT, usar JSON.parse/stringify
- [feedback_pellet_consolidation.md](feedback_pellet_consolidation.md) — CP OP10: 2 pellets, NO 4. AIAG CP 2024
- [feedback_use_skills_proactively.md](feedback_use_skills_proactively.md) — Usar baseline-ui y skills automaticamente
- [feedback_simple_language.md](feedback_simple_language.md) — Lenguaje CORTO y SIMPLE en AMFE/CP/HO. Max 8-10 palabras
- [feedback_auditor_role.md](feedback_auditor_role.md) — Protocolo auditoria post-carga (checklist A-I)

## Referencias operacionales

- [reference_server_paths.md](reference_server_paths.md) — Rutas servidor VWA/PWA
- [reference_novax_tapizadas.md](reference_novax_tapizadas.md) — Ruta NOVAX: Insert, APB, Top Roll
- [reference_injection_master.md](reference_injection_master.md) — Maestro Inyeccion, familia 15, 7 productos sync
- [project_ippad_process.md](project_ippad_process.md) — IP PAD: 4 versiones PL0-PL3, part numbers FAKOM
- [reference_notebooklm_setup.md](reference_notebooklm_setup.md) — NotebookLM: config, notebooks, patrones de consulta

## En NotebookLM — Consultar on-demand (no cargar en contexto)

Guias APQP, errores, lecciones: `ask_question --notebook-id apqp-guias-y-conocimiento`
Auditorias, historial, comparaciones: `ask_question --notebook-id auditorias-e-historial`
