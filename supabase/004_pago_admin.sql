-- El cliente solo elige el método; el negocio registra la referencia al cobrar.
alter table citas add column if not exists metodo_pago text;
alter table negocios alter column liberar_horas set default 0;
update negocios set liberar_horas = 0 where liberar_horas <> 0;
