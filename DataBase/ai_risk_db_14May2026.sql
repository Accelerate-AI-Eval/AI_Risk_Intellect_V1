--
-- PostgreSQL database dump
--

\restrict E3Qtf6HZU5jVQMxt2ZXmyayhaZqC5HLrpiX55EKjKGg6dopyeuLuXfa91FC6Nl3

-- Dumped from database version 17.8
-- Dumped by pg_dump version 17.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO postgres;

--
-- Name: user_account_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_account_status AS ENUM (
    'pending',
    'completed',
    'expired'
);


ALTER TYPE public.user_account_status OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: postgres
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO postgres;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: postgres
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNER TO postgres;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: postgres
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    user_agent character varying(512),
    ip_address character varying(64),
    revoked boolean DEFAULT false NOT NULL,
    replaced_by_id uuid,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    access_token_hash text
);


ALTER TABLE public.refresh_tokens OWNER TO postgres;

--
-- Name: user_profile_update_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_profile_update_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_user_id uuid NOT NULL,
    updated_by_user_id uuid NOT NULL,
    reason text NOT NULL,
    changes jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_profile_update_logs OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(64) NOT NULL,
    password_hash text,
    full_name character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    account_status public.user_account_status DEFAULT 'pending'::public.user_account_status NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: postgres
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
1	880ed6ed3273b32587dde1c1692901fab57688228f292f635660ff14bd64eb00	1778568231639
2	6d0eb3fbefc78e681a2463761a4ff73a918df9993d9a6018dd35f1778f358910	1778571838687
3	858e0cc0331c662efeeec65cdba4c1355899433c544b87b2b0d118bfc644997f	1778600000000
4	68da55c6f287c9978c98b6ace57cbfe028a445919f3a2f0def2d167c6354642b	1778700000000
5	e7bb85ea2a047bf1e579ea3cb5f6eed8a7bff5fe81241d3a7e513c539f2876a1	1778800000000
6	bd48163954e13cc0cfe0e44e6dbb00547475e737394fe001703e434b635a12dc	1778900000000
7	a1ff3d4d1903973c096fe4879d426ed75e9b7ee034dfe7519c327c4e97e0d03b	1779000000000
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at) FROM stdin;
30aa2a2a-5601-4d41-b882-d846d7c4109a	7c8717f1-73e6-4768-afe8-63d41dfcc725	d23e131cd4811083883c5f3bc832839e9d1b91b1e8ec76cd08e5cf5ae38d4c69	2026-05-12 16:23:58.043+05:30	2026-05-12 15:25:42.17+05:30	2026-05-12 15:23:58.046236+05:30
0f643910-5dd4-46b2-9e08-b376b5fbdf60	7c8717f1-73e6-4768-afe8-63d41dfcc725	58ee05fce3afb17ede13be3914a7c5c39176c3e86a628969919d8b7e2688060e	2026-05-12 17:13:31.77+05:30	2026-05-12 16:14:10.499+05:30	2026-05-12 16:13:31.771699+05:30
24592a6e-3fcb-4ef4-be5b-6777f6120d97	7c8717f1-73e6-4768-afe8-63d41dfcc725	faf7341105c963232575bd02a5bff4935d88bc811542d39879f30c1f8c68b3dc	2026-05-12 17:23:56.142+05:30	2026-05-12 16:24:54.646+05:30	2026-05-12 16:23:56.143665+05:30
b85a0878-0992-4aac-a9bd-31ce6a27858d	7c8717f1-73e6-4768-afe8-63d41dfcc725	607b099f3e264221b2dd23632052b2405b40257aecb1a901200dfd556d096e11	2026-05-14 13:37:20.638+05:30	\N	2026-05-14 12:37:20.640637+05:30
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.refresh_tokens (id, user_id, token_hash, user_agent, ip_address, revoked, replaced_by_id, expires_at, created_at, access_token_hash) FROM stdin;
e9be1833-7f8e-4ee5-b266-07f1e1ea6188	7c8717f1-73e6-4768-afe8-63d41dfcc725	440809e511cfada054d3ace04bfc9759f9306aca492c874a55cb9a309d6565fc	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	t	\N	2026-05-19 15:20:26.058+05:30	2026-05-12 15:20:26.064029+05:30	dcb79333538725c4a5a63b92eb9cc5dcd11a97130e5c97bb55d93d3178acf433
e4aada3c-03a9-4246-9772-7d1556be090f	7c8717f1-73e6-4768-afe8-63d41dfcc725	860dbc53c7dd2afbd91026dbf34b56743f650dfa6f49c217c7ea5001587d7ade	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	::1	t	\N	2026-05-19 14:35:43.939+05:30	2026-05-12 14:35:43.945535+05:30	f861ea62623f156e8be555aa8bbad041f620a464c9f4626d225038b1e730b0dc
723e462f-9bab-4e02-ad2a-941fc1f3caaa	7c8717f1-73e6-4768-afe8-63d41dfcc725	c977688c39400e4cd7a661a8da44f6a70480abd11b438972305bbb4579d3fb6a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	::1	t	\N	2026-05-19 15:25:42.394+05:30	2026-05-12 15:25:42.39705+05:30	3e2f3dd5632cc3889e1b2204dd4c526d123474aa0f9a60cfed6421f33cb18e5a
9f1885cf-a167-4d77-b40a-96fe59e5301f	7c8717f1-73e6-4768-afe8-63d41dfcc725	4bbe33ad0a7c6e2dfa7fd7742f8ad048b71d2acd13fb6d1efa8aedc28a6d6a39	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	::1	t	\N	2026-05-19 16:14:10.552+05:30	2026-05-12 16:14:10.555075+05:30	20a57ac81fb5dce807b1707598ade73f742b374ca825b7395b642da18756c5de
18d1a72d-8253-423b-8dd1-15dda2939863	0aba8015-a7eb-4986-9191-d4ef807a40f7	7f4b5121ae42abcda4666b6cf7bb63bf29a82cc053d31832a235f6ce6c3ff27d	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-19 15:29:44.294+05:30	2026-05-12 15:29:44.29736+05:30	e3b366121ebffedb45d4e63691bf16c0f38445dcd395d8c2eeaa8adf1431593a
b35c37b3-da6a-4a8e-bbee-6dbb68d42548	0aba8015-a7eb-4986-9191-d4ef807a40f7	d23e9b7463740a61a00825459c5aefb10a1240181f3175044e3c9ed11721770a	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-19 15:46:59.82+05:30	2026-05-12 15:46:59.822698+05:30	461a8514fdcdfb1bf392f74876b7d993ee4a64c0d2c8e1b4d3e998e72c280323
4646983a-1226-48d5-91f4-2a94327b447e	0aba8015-a7eb-4986-9191-d4ef807a40f7	e7cfe9206728a0038e736156ee68b09c1dc6b0038655c91490aa0b98e6d0a4f7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0	::1	f	\N	2026-05-19 14:04:10.296+05:30	2026-05-12 14:04:10.300345+05:30	bfeea66d84b74b30c09c050f6a9867223b862273dbfa30ad9684405791477c02
a2f73d6e-06fa-4724-85cb-9d4f1ff32502	0aba8015-a7eb-4986-9191-d4ef807a40f7	ee2ca41416edef5ab14d5c117ccabf32ffa24466f1e5449f00bfb301c58056d6	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	t	\N	2026-05-19 14:04:55.055+05:30	2026-05-12 14:04:55.058056+05:30	a4c684423ab694ea22a8fd87deef8ccd066f584af1f513d43d6aecd428b5182f
ee2c2821-c73b-422c-9941-b6c1f0845063	0aba8015-a7eb-4986-9191-d4ef807a40f7	d2024ee34aec2a026026a02c8fa1c5536265e9434d9ed222ec8b2005eb201eb4	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	t	\N	2026-05-19 14:29:20.77+05:30	2026-05-12 14:29:20.780037+05:30	2db01e8d0d95369187d8451924dbe908d3c4e3dd42a2884244530f93822b18e3
5c373034-7a99-4521-ae34-497b5379b386	0aba8015-a7eb-4986-9191-d4ef807a40f7	cf6b6abfa39609fd5301f2c7686c3318fa55b61e189c0406c23e80c8bffc78d2	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-19 14:45:31.908+05:30	2026-05-12 14:45:31.910452+05:30	3e9375d0118bd5c0704ef1cfec96b34f22462a3c4d295916c5818ebef953389d
29c20f72-189a-49d8-8e05-798a010b558f	0aba8015-a7eb-4986-9191-d4ef807a40f7	082b5ec5b46e96dfee24e2ebd161b7683af58a70b1b87f13dd89079ddc739b53	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	t	\N	2026-05-19 15:02:56.861+05:30	2026-05-12 15:02:56.863866+05:30	c6756a77f304eb5befcbe30f1d97173fee9adf95b6e1cbcceaf44b38344202e3
c3cafed4-d02f-44cb-9ed7-0ccf4815dd88	7c8717f1-73e6-4768-afe8-63d41dfcc725	47b38450a176c5122e819de96818f9425b56ee9ff2f5d223b238eafec9c3faa2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	::1	f	\N	2026-05-19 16:24:54.673+05:30	2026-05-12 16:24:54.675266+05:30	594b664a777516d46e0fe152b594c6c9abf973c8a1b4771024f34e09c21a8491
f03d6fb2-c54e-45ae-a0f0-192d603f0317	0aba8015-a7eb-4986-9191-d4ef807a40f7	310bba1939ade6e18617a375c223edf80bbe96f1340cdd1f8b05fcd714de0d99	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	t	\N	2026-05-19 16:04:38.877+05:30	2026-05-12 16:04:38.883639+05:30	adb623568805d19fa8f03d48d893641e50703f6b2de3d7de3673a2f8575450bb
4fc528cf-b18f-4409-86dc-a9cd2a9cf9b9	0aba8015-a7eb-4986-9191-d4ef807a40f7	43373c995c61443ccaa6d6766830d5f413e0c34258de85dc31432b0d5d94fa39	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	t	\N	2026-05-19 17:02:40.519+05:30	2026-05-12 17:02:40.523672+05:30	e4eea00e42d9f59981671560f0f16aed7a94171337cd209ccfa5da103222f38c
5bea13e9-7fef-45a7-9209-8ca2da087396	0aba8015-a7eb-4986-9191-d4ef807a40f7	c51ac196f48c0484d9a877f0d7d98703b11c7ca589e67e10c8ec69286900d623	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-19 18:40:23.574+05:30	2026-05-12 18:40:23.579283+05:30	f814fe4478c9944730466a822b355bc2b1c6d373afa7cdd0a5d118bcbbec4171
ec67d97d-fcde-4972-b031-8a47ea84adad	0aba8015-a7eb-4986-9191-d4ef807a40f7	2bf3aa6eb5a58d78ab8078458ee94699dd879911e801156502aa383c310182d6	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-19 16:40:22.349+05:30	2026-05-12 16:40:22.352995+05:30	21b213a393d175ec5bddcfcb16f266a25149a00c0dd569b4d5f38e670ea0777e
36c41818-f534-4c4a-9df9-4339214fc137	0aba8015-a7eb-4986-9191-d4ef807a40f7	3d47f66c9d111ecdc533cfda646ec69b41020bd2108619c4a2a68ec5afdfde0b	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-20 14:15:46.523+05:30	2026-05-13 14:15:46.526624+05:30	0dc820038712ed691eb06390c31512ea0abec871486cf2c7806cb7ad2de04d87
f1d65325-b788-47a8-a575-dad23f1294e9	0aba8015-a7eb-4986-9191-d4ef807a40f7	e362f4048f076418befb3dcf8def50d7f692dcf2fc00f55a45d40aa27f7f76d3	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	::1	t	\N	2026-05-19 16:42:06.305+05:30	2026-05-12 16:42:06.306979+05:30	95ba0dca7470af3fc976fdb8155d9eff34984568c0edbdc96cb4b557c96b5c39
288917cd-caa3-4873-9cf1-3f6be69f23ea	0aba8015-a7eb-4986-9191-d4ef807a40f7	6d05e7a76f70af1eaeafd40453cd08272948e4a4efdc626e25fe49e49fd8de4a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	::1	f	\N	2026-05-19 16:44:07.585+05:30	2026-05-12 16:44:07.586327+05:30	29d0d09ed6e7d3020554190b0b5f9aa87b9161be68d75c437b1a385121355c51
9ef4249e-3d7f-4bbc-bfa5-884f39e9c049	0aba8015-a7eb-4986-9191-d4ef807a40f7	be2fd0ecb6ab4b3848b70b98c04374fe514089c8c092300fad75b6d54a46d461	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-20 15:03:42.388+05:30	2026-05-13 15:03:42.394464+05:30	557807b27a992b07b17644dab7119990b6c85c8671b146fd36524602457e6c5f
bf80771e-f28d-4f43-bc65-28161f4b092c	0aba8015-a7eb-4986-9191-d4ef807a40f7	845df2addf2db17ed966dc78d91a80411d1842e77cce78a5c2f80a8fe26d4dd4	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-20 15:19:07.584+05:30	2026-05-13 15:19:07.587849+05:30	2112b7d587475a652cdb781aec73d427b21e9d0092f4fee5c37c31010f5af20e
a873582a-4ca6-4a79-b089-70c85dcad5f8	0aba8015-a7eb-4986-9191-d4ef807a40f7	7b3dc8c8d048d40a3802f7291330f9934a373bcd1444424361ec341e1cff674c	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-20 15:40:06.854+05:30	2026-05-13 15:40:06.861022+05:30	f3d9f80d92e393f160cbf793c52cd12312a4d68aa284abf4a1c87d75a18b796e
b3c7980b-6e68-4251-82a3-86bb82d77d14	0aba8015-a7eb-4986-9191-d4ef807a40f7	637e6f682afcae79bda428660794428fda7363ee8820a8ea08b4af70330876dc	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-20 15:59:02.775+05:30	2026-05-13 15:59:02.777309+05:30	30cc29cc5cb5834ccb2e0e8fac1842f8c0d6c381fa26d2efea6d32510a7c5ce6
2155ec0d-399a-4161-a089-cfedabefe30b	0aba8015-a7eb-4986-9191-d4ef807a40f7	9063261f0148f140d7a58be9d18e58d025786993c71f8b129890c357a7d9aab7	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-20 16:44:40.616+05:30	2026-05-13 16:44:40.620755+05:30	7de00bd1d2d05ea3ccbf29935dc80ab5c6b6cff74e4350c186bfc5edf98a1c0f
af89af39-816a-480c-88d9-8ac0bc0e918c	0aba8015-a7eb-4986-9191-d4ef807a40f7	974faeff0bd681db7aaf235ee0c7258c7a8bf86a0b7bf30b793a5e50a1c81eac	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-21 08:49:55.651+05:30	2026-05-14 08:49:55.655907+05:30	cecd19b456cfa715757035c6b3d328067ce9f851f2e0e8c7aa56abe489f0c40f
93808688-e9cb-4b6c-8c3a-9e4d1e554a7c	0aba8015-a7eb-4986-9191-d4ef807a40f7	6d1823b163fb2fcbc9ccfea253163629992dcf5bcfad015e492d41441a88f635	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	t	\N	2026-05-21 11:20:45.543+05:30	2026-05-14 11:20:45.546278+05:30	dba4d5bd97911f0fb1a64ed1518524d0af8dc9b8d983044e6c75ebcee5d8807e
9a28ab89-7a2b-4198-bbbc-deeaa981a144	0aba8015-a7eb-4986-9191-d4ef807a40f7	968d23d585607ac943b703ee9e52baa4d2ab582c1ab9b44d60cd73d16ca90c9e	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	t	\N	2026-05-21 11:21:02.438+05:30	2026-05-14 11:21:02.439548+05:30	1e236fd9a327758a101fedfeddbc7ef55fa003a80513c86b05a5c5c422f87a0d
e019a629-0595-4f41-a09b-ceccfad8ebc7	0aba8015-a7eb-4986-9191-d4ef807a40f7	e86663c62131f410f621df1c7bfd42450c2d48c481240dd804e88a1e342516ff	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-21 11:21:07.593+05:30	2026-05-14 11:21:07.594844+05:30	619710fc7dd5bebb10da7249ebc1f657a1d38d39964760ea8f04877aea390de7
7f43b57d-d3ea-4606-a138-a3ce15a8e21f	0aba8015-a7eb-4986-9191-d4ef807a40f7	64e36cf6c7f9f7ed2c1306633bc205d53918eba4fddb4f0bbf2b37966de4d350	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-21 11:49:18.849+05:30	2026-05-14 11:49:18.855868+05:30	aaae52942245b6bbd113eda252fd43029d49f5522412db5262644a4c71362117
5f9ed6b9-9260-43ee-8529-0992a3467be8	0aba8015-a7eb-4986-9191-d4ef807a40f7	85ca149e34516207ac84dfaf791caed5df204cdf2e825634492e17ea93bb82f6	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-21 12:15:34.248+05:30	2026-05-14 12:15:34.254306+05:30	d6c9faa4e52ab779dfdf8dafb853ae6ba462cf88a67533064cd936cf036a2631
509e4780-79c6-4383-86c6-fa35fa37b644	aa0ef345-4f75-4886-8171-21597c26cbb0	ea8dadc6ddd687457cbb9bdd05d61d4a575a63cad65d84f30de85d9e07ad4d36	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	::1	t	\N	2026-05-19 18:42:54.602+05:30	2026-05-12 18:42:54.604249+05:30	297f6187fbc07aeeeed815a6a32a0f51d6a9bca18f23dc64f2bd926cb233e34f
ff1f7a75-fe65-4cd6-a3b3-7d720403787d	0aba8015-a7eb-4986-9191-d4ef807a40f7	f00570186beeb02be7145ccf36ebd6058a7872aa76207e46eca7f6d2818d997a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	::1	f	\N	2026-05-21 12:20:40.077+05:30	2026-05-14 12:20:40.081597+05:30	0ea6376c742db86675ae5de2cd3c6e7066446af51ab0344c400cf0e4b5ba7fd7
5c9a229e-5b98-4bb2-b326-9689f855583e	0aba8015-a7eb-4986-9191-d4ef807a40f7	ee9f65dba317ea7354bbf9d1369a31d88ee36bbc52655982f15b6d64fd4d50bf	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0	::ffff:127.0.0.1	f	\N	2026-05-21 12:35:13.458+05:30	2026-05-14 12:35:13.460688+05:30	6c0a7f4ec8b84c561e31285b2e46cdcbf37c02ff0df683ce0de62c20e7d1897b
da8fdb17-244b-4c68-bd41-47dabe7559ac	7c8717f1-73e6-4768-afe8-63d41dfcc725	4f9fa13daa5e8fff050d405cf648e05aab06d280abfe7433eb6e8096cdf48411	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0	::1	t	\N	2026-05-21 12:37:14.63+05:30	2026-05-14 12:37:14.633344+05:30	d7203e2813e96cee5d2711e9ef3930ed8f1029f99c14b4619d27d56da1a54e34
\.


--
-- Data for Name: user_profile_update_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_profile_update_logs (id, target_user_id, updated_by_user_id, reason, changes, created_at) FROM stdin;
a6a41837-b1dd-4da8-9b01-3f7e5ffbbcfe	7c8717f1-73e6-4768-afe8-63d41dfcc725	0aba8015-a7eb-4986-9191-d4ef807a40f7	a	{"isActive": {"to": false, "from": true}}	2026-05-14 12:17:16.435284+05:30
da60a10d-2c70-4c1e-97d2-54f08a197ffd	7c8717f1-73e6-4768-afe8-63d41dfcc725	0aba8015-a7eb-4986-9191-d4ef807a40f7	q	{"isActive": {"to": true, "from": false}}	2026-05-14 12:36:38.600899+05:30
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, username, password_hash, full_name, is_active, created_at, updated_at, account_status) FROM stdin;
0aba8015-a7eb-4986-9191-d4ef807a40f7	admin@work.com	Admin	$2b$12$YJnYEIzb.WlycJlRfPPhPesys7wYJwwMcDKWwL73CdccHIAobi0Py	Administrator	t	2026-05-12 12:20:09.684943+05:30	2026-05-14 11:21:07.588+05:30	completed
aa0ef345-4f75-4886-8171-21597c26cbb0	email01@test.com	email01	$2b$12$9wUtPmTZWoHPaYn.XjbcJuLi0z91wf1z5CawA79zQquYshEdzia0q	\N	t	2026-05-12 18:42:03.071546+05:30	2026-05-14 11:49:33.076+05:30	completed
7c8717f1-73e6-4768-afe8-63d41dfcc725	email@test.com	email	$2b$12$XFAoVlQFL3n16BgNH10nTOu4OYpcc6L3vXhU4szKuxc2G0tIP41Bi	\N	t	2026-05-12 14:33:46.081241+05:30	2026-05-14 12:36:38.604+05:30	completed
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: postgres
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 7, true);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_unique UNIQUE (token_hash);


--
-- Name: refresh_tokens refresh_tokens_access_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_access_token_hash_unique UNIQUE (access_token_hash);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash);


--
-- Name: user_profile_update_logs user_profile_update_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profile_update_logs
    ADD CONSTRAINT user_profile_update_logs_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: password_reset_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX password_reset_tokens_user_id_idx ON public.password_reset_tokens USING btree (user_id);


--
-- Name: refresh_tokens_access_token_hash_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX refresh_tokens_access_token_hash_idx ON public.refresh_tokens USING btree (access_token_hash);


--
-- Name: refresh_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX refresh_tokens_user_id_idx ON public.refresh_tokens USING btree (user_id);


--
-- Name: user_profile_update_logs_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_profile_update_logs_created_at_idx ON public.user_profile_update_logs USING btree (created_at);


--
-- Name: user_profile_update_logs_target_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_profile_update_logs_target_user_id_idx ON public.user_profile_update_logs USING btree (target_user_id);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_username_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_username_idx ON public.users USING btree (username);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_profile_update_logs user_profile_update_logs_target_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profile_update_logs
    ADD CONSTRAINT user_profile_update_logs_target_user_id_users_id_fk FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_profile_update_logs user_profile_update_logs_updated_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profile_update_logs
    ADD CONSTRAINT user_profile_update_logs_updated_by_user_id_users_id_fk FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict E3Qtf6HZU5jVQMxt2ZXmyayhaZqC5HLrpiX55EKjKGg6dopyeuLuXfa91FC6Nl3

