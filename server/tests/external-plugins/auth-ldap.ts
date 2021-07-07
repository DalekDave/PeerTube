/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import { User } from '@shared/models/users/user.model'
import { blockUser, getMyUserInformation, setAccessTokensToServers, unblockUser, uploadVideo, userLogin } from '../../../shared/extra-utils'
import { cleanupTests, flushAndRunServer, ServerInfo } from '../../../shared/extra-utils/server/servers'

describe('Official plugin auth-ldap', function () {
  let server: ServerInfo
  let accessToken: string
  let userId: number

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    await server.pluginsCommand.install({ npmName: 'peertube-plugin-auth-ldap' })
  })

  it('Should not login with without LDAP settings', async function () {
    await userLogin(server, { username: 'fry', password: 'fry' }, 400)
  })

  it('Should not login with bad LDAP settings', async function () {
    await server.pluginsCommand.updateSettings({
      npmName: 'peertube-plugin-auth-ldap',
      settings: {
        'bind-credentials': 'GoodNewsEveryone',
        'bind-dn': 'cn=admin,dc=planetexpress,dc=com',
        'insecure-tls': false,
        'mail-property': 'mail',
        'search-base': 'ou=people,dc=planetexpress,dc=com',
        'search-filter': '(|(mail={{username}})(uid={{username}}))',
        'url': 'ldap://localhost:390',
        'username-property': 'uid'
      }
    })

    await userLogin(server, { username: 'fry', password: 'fry' }, 400)
  })

  it('Should not login with good LDAP settings but wrong username/password', async function () {
    await server.pluginsCommand.updateSettings({
      npmName: 'peertube-plugin-auth-ldap',
      settings: {
        'bind-credentials': 'GoodNewsEveryone',
        'bind-dn': 'cn=admin,dc=planetexpress,dc=com',
        'insecure-tls': false,
        'mail-property': 'mail',
        'search-base': 'ou=people,dc=planetexpress,dc=com',
        'search-filter': '(|(mail={{username}})(uid={{username}}))',
        'url': 'ldap://localhost:10389',
        'username-property': 'uid'
      }
    })

    await userLogin(server, { username: 'fry', password: 'bad password' }, 400)
    await userLogin(server, { username: 'fryr', password: 'fry' }, 400)
  })

  it('Should login with the appropriate username/password', async function () {
    accessToken = await userLogin(server, { username: 'fry', password: 'fry' })
  })

  it('Should login with the appropriate email/password', async function () {
    accessToken = await userLogin(server, { username: 'fry@planetexpress.com', password: 'fry' })
  })

  it('Should login get my profile', async function () {
    const res = await getMyUserInformation(server.url, accessToken)
    const body: User = res.body

    expect(body.username).to.equal('fry')
    expect(body.email).to.equal('fry@planetexpress.com')

    userId = body.id
  })

  it('Should upload a video', async function () {
    await uploadVideo(server.url, accessToken, { name: 'my super video' })
  })

  it('Should not be able to login if the user is banned', async function () {
    await blockUser(server.url, userId, server.accessToken)

    await userLogin(server, { username: 'fry@planetexpress.com', password: 'fry' }, 400)
  })

  it('Should be able to login if the user is unbanned', async function () {
    await unblockUser(server.url, userId, server.accessToken)

    await userLogin(server, { username: 'fry@planetexpress.com', password: 'fry' })
  })

  it('Should not login if the plugin is uninstalled', async function () {
    await server.pluginsCommand.uninstall({ npmName: 'peertube-plugin-auth-ldap' })

    await userLogin(server, { username: 'fry@planetexpress.com', password: 'fry' }, 400)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
