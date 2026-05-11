import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // This will refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Protect the dashboard and measurements routes
  const protectedRoutes = ['/adash', '/cdash', '/measurements']
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route))

  if (isProtectedRoute && !user) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Admin routing logic based on user role from profiles table or email
  if (pathname.startsWith('/adash')) {
    let isAdmin = false
    
    if (user?.email?.includes('zchacha') || user?.email?.includes('admin')) {
        isAdmin = true
    } else if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role === 'admin') {
            isAdmin = true
        }
    }

    if (!isAdmin && user) {
        // User is logged in but not an admin
        const url = request.nextUrl.clone()
        url.pathname = '/cdash' // redirect to client dash instead
        return NextResponse.redirect(url)
    }
  }

  // Client routing logic (redirect admin to admin dash if they go to cdash)
  if (pathname.startsWith('/cdash')) {
      let isAdmin = false
      if (user?.email?.includes('zchacha') || user?.email?.includes('admin')) {
          isAdmin = true
      } else if (user) {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
          if (profile?.role === 'admin') {
              isAdmin = true
          }
      }
      
      if (isAdmin && user) {
          const url = request.nextUrl.clone()
          url.pathname = '/adash'
          return NextResponse.redirect(url)
      }
  }

  return supabaseResponse
}
