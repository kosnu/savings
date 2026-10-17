package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
)

// migrationから構築した実DBを比較元にし、文書にschemaやACLの複製を持たない。
const schemaStateSQL = `select pg_catalog.json_build_object(
 'migrations',(select pg_catalog.json_agg(version order by version) from supabase_migrations.schema_migrations),
 'tables',(select pg_catalog.json_agg(pg_catalog.json_build_array(c.relname,c.relrowsecurity,c.relforcerowsecurity) order by c.relname) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v','m','p')),
 'policies',(select pg_catalog.json_agg(pg_catalog.to_jsonb(p) order by p.tablename,p.policyname) from pg_catalog.pg_policies p where p.schemaname='public'),
 'indexes',(select pg_catalog.json_agg(pg_catalog.json_build_array(tablename,indexname,indexdef) order by tablename,indexname) from pg_catalog.pg_indexes where schemaname='public'),
 'functions',(select pg_catalog.json_agg(pg_catalog.json_build_array(p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid),pg_catalog.pg_get_functiondef(p.oid)) order by p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid)) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prorettype not in ('trigger'::regtype,'event_trigger'::regtype)),
 'privileges',(select pg_catalog.json_agg(pg_catalog.json_build_array(c.relname,r.role,a.attname,pg_catalog.has_column_privilege(r.role,c.oid,a.attnum,'SELECT'),pg_catalog.has_column_privilege(r.role,c.oid,a.attnum,'INSERT'),pg_catalog.has_column_privilege(r.role,c.oid,a.attnum,'UPDATE'),pg_catalog.has_table_privilege(r.role,c.oid,'DELETE'),pg_catalog.has_table_privilege(r.role,c.oid,'TRUNCATE')) order by c.relname,r.role,a.attnum) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped cross join (values ('anon'),('authenticated'),('service_role')) r(role) where n.nspname='public' and c.relkind in ('r','v','m','p')),
 'execute',(select pg_catalog.json_agg(pg_catalog.json_build_array(p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid),r.role,pg_catalog.has_function_privilege(r.role,p.oid,'EXECUTE')) order by p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid),r.role) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace cross join (values ('anon'),('authenticated'),('service_role')) r(role) where n.nspname='public' and p.prorettype not in ('trigger'::regtype,'event_trigger'::regtype))
) as state;`

func compareDevSchema(ctx context.Context, a api, token string) error {
	baseline, err := sql(ctx, schemaStateSQL)
	if err != nil {
		return err
	}
	var want any
	if err = json.Unmarshal(baseline, &want); err != nil {
		return err
	}
	r, err := a.request(ctx, "POST", "/database/query/read-only", token, row{"query": schemaStateSQL})
	if err != nil {
		return err
	}
	var result []struct {
		State any `json:"state"`
	}
	if err = r.decode(&result); err != nil {
		return fmt.Errorf("Dev schema読み取り不能（未確認）: %w", err)
	}
	if len(result) != 1 {
		return errors.New("Dev schema照合の応答が不完全です")
	}
	if !reflect.DeepEqual(want, result[0].State) {
		return errors.New("Devのmigration・policy・index・権限・RPC定義が比較元と一致しません")
	}
	fmt.Println("PASS Dev migration・RLS・権限・RPC照合")
	return nil
}
