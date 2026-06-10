export const ADMIN_USERS = [
  {
    id: 1,
    name: 'Thiago Admin',
    email: 'admin@junttos.com.br',
    password: 'teste123',
    role: 'Super Admin',
    avatar: 'TA',
  },
  {
    id: 2,
    name: 'Gestor Junttos',
    email: import.meta.env.VITE_GESTOR_EMAIL,
    password: import.meta.env.VITE_GESTOR_PASSWORD,
    role: 'Gestor',
    avatar: 'GJ',
  },
]
