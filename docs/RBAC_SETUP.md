# Role-Based Access Control (RBAC) Setup

## ✅ RBAC System Enabled

The Nexora CRM now has a fully functional **Role-Based Access Control (RBAC)** system that controls access to all features based on user roles and permissions.

## 📊 System Overview

### Permissions Created: **55 permissions** across all modules

#### CRM Module (17 permissions)

- `crm:contacts:read` - View contacts
- `crm:contacts:create` - Create contacts
- `crm:contacts:update` - Update contacts
- `crm:contacts:delete` - Delete contacts
- `crm:companies:read` - View companies
- `crm:companies:create` - Create companies
- `crm:companies:update` - Update companies
- `crm:companies:delete` - Delete companies
- `crm:activities:read` - View activities
- `crm:activities:create` - Create activities
- `crm:activities:update` - Update activities
- `crm:activities:delete` - Delete activities
- `crm:segments:read` - View segments
- `crm:segments:create` - Create segments
- `crm:segments:update` - Update segments
- `crm:segments:delete` - Delete segments
- `crm:*` - All CRM permissions

#### Pipeline Module (5 permissions)

- `pipeline:deals:read` - View deals
- `pipeline:deals:create` - Create deals
- `pipeline:deals:update` - Update deals
- `pipeline:deals:delete` - Delete deals
- `pipeline:*` - All Pipeline permissions

#### Inbox Module (5 permissions)

- `inbox:read` - View inbox messages
- `inbox:reply` - Reply to messages
- `inbox:assign` - Assign conversations
- `inbox:manage` - Manage inbox settings
- `inbox:*` - All Inbox permissions

#### Tickets Module (6 permissions)

- `tickets:read` - View tickets
- `tickets:create` - Create tickets
- `tickets:update` - Update tickets
- `tickets:delete` - Delete tickets
- `tickets:assign` - Assign tickets
- `tickets:*` - All Tickets permissions

#### Marketing Module (6 permissions)

- `marketing:campaigns:read` - View campaigns
- `marketing:campaigns:create` - Create campaigns
- `marketing:campaigns:update` - Update campaigns
- `marketing:campaigns:delete` - Delete campaigns
- `marketing:broadcasts:send` - Send broadcasts
- `marketing:*` - All Marketing permissions

#### Analytics Module (3 permissions)

- `analytics:read` - View analytics
- `analytics:export` - Export reports
- `analytics:*` - All Analytics permissions

#### Settings Module (4 permissions)

- `settings:read` - View settings
- `settings:update` - Update settings
- `settings:integrations` - Manage integrations
- `settings:*` - All Settings permissions

#### Team Module (5 permissions)

- `team:read` - View team members
- `team:invite` - Invite team members
- `team:update` - Update team members
- `team:remove` - Remove team members
- `team:*` - All Team permissions

#### Billing Module (3 permissions)

- `billing:read` - View billing
- `billing:manage` - Manage billing
- `billing:*` - All Billing permissions

#### System (1 permission)

- `*` - Full system access (Super Admin only)

---

## 👥 Default Roles

### 1. **Super Admin**

**Full system access with no restrictions**

Permissions:

- `*` (All permissions)

### 2. **Admin**

**Administrative access to most features**

Permissions:

- All CRM, Pipeline, Inbox, Tickets, Marketing, Analytics, Settings, Team, and Billing permissions

### 3. **Manager**

**Team oversight with management capabilities**

Permissions:

- Full CRM, Pipeline, Inbox, Tickets access
- Read analytics and export reports
- View and invite team members
- Read-only settings access

### 4. **Sales**

**Sales team members**

Permissions:

- Read, create, update contacts and companies
- Manage activities
- Manage deals (read, create, update)
- Read and reply to inbox messages
- View analytics

### 5. **Support**

**Customer support agents**

Permissions:

- Full inbox access (read, reply, assign)
- Full tickets access (read, create, update, assign)
- Read and update contacts
- Manage activities
- View analytics

### 6. **Marketing**

**Marketing team members**

Permissions:

- Full marketing access (campaigns, broadcasts)
- Read contacts and manage segments
- View and export analytics
- Read inbox messages

### 7. **Member**

**Basic team member**

Permissions:

- Read contacts, companies, activities
- Create activities
- Read and reply to inbox messages
- View analytics

---

## 🔧 How It Works

### 1. Authentication Middleware

Location: `nexora-api/src/common/middleware/authenticate.js`

The `authenticate` middleware:

- Verifies JWT token
- Loads user with roles and permissions
- Calculates permission set from all assigned roles
- Attaches user context to request

```javascript
// Attached to req.user:
{
  id: 'user-id',
  tenantId: 'tenant-id',
  permissions: ['crm:contacts:read', 'crm:contacts:create', ...],
  roleLevel: 9 // Numeric level for quick checks
}
```

### 2. Authorization Middleware

The `authorize` middleware checks if user has required permissions:

```javascript
import { authorize } from '../common/middleware/authenticate.js';

// Single permission required
router.get('/contacts', authorize('crm:contacts:read'), async (req, res) => {
  // Handler code
});

// Any of multiple permissions
router.post('/contacts', authorize('crm:contacts:create', 'crm:*'), async (req, res) => {
  // User needs either crm:contacts:create OR crm:* permission
});
```

### 3. Permission Checking

**Wildcard Permissions:**

- `*` - Grants access to everything (Super Admin)
- `crm:*` - Grants access to all CRM operations
- `module:*` - Grants access to all operations in that module

**Hierarchy:**

- More specific permissions override wildcards
- User can have multiple roles (permissions are combined)

---

## 📝 Usage Examples

### Protecting API Routes

```javascript
import { authenticate, authorize } from '../common/middleware/authenticate.js';

const router = Router();

// All routes need authentication
router.use(authenticate);

// Read contacts - requires read permission
router.get('/contacts', authorize('crm:contacts:read'), async (req, res) => {
  // Only users with crm:contacts:read permission can access
});

// Create contact - requires create permission
router.post('/contacts', authorize('crm:contacts:create'), async (req, res) => {
  // Only users with crm:contacts:create permission can access
});

// Delete contact - requires delete OR admin permission
router.delete('/contacts/:id', authorize('crm:contacts:delete', 'crm:*'), async (req, res) => {
  // User needs either delete permission or full CRM access
});
```

### Checking Permissions in Code

```javascript
// Check if user has specific permission
if (req.user.permissions.includes('crm:contacts:delete')) {
  // User can delete contacts
}

// Check for multiple permissions
const canManageSettings = req.user.permissions.some((p) =>
  ['settings:update', 'settings:*', '*'].includes(p)
);
```

---

## 🔄 Managing Roles and Permissions

### Assigning Roles to Users

```javascript
// Assign role to user
await prisma.userRole.create({
  data: {
    userId: 'user-id',
    roleId: 'role-id',
  },
});

// Remove role from user
await prisma.userRole.delete({
  where: {
    userId_roleId: {
      userId: 'user-id',
      roleId: 'role-id',
    },
  },
});
```

### Creating Custom Roles

```javascript
// 1. Create the role
const customRole = await prisma.role.create({
  data: {
    tenantId: 'tenant-id',
    name: 'Custom Role',
    description: 'Custom role description',
    isSystem: false,
  },
});

// 2. Assign permissions to the role
const permissions = await prisma.permission.findMany({
  where: {
    code: {
      in: ['crm:contacts:read', 'crm:contacts:create', 'inbox:read'],
    },
  },
});

for (const perm of permissions) {
  await prisma.rolePermission.create({
    data: {
      roleId: customRole.id,
      permissionId: perm.id,
    },
  });
}
```

---

## ⚙️ Configuration

### Running RBAC Setup

To set up RBAC for all tenants:

```bash
cd nexora-api
node packages/database/prisma/seed-rbac.js
```

This will:

1. Create all 55 permissions (if they don't exist)
2. Create 7 default roles for each tenant
3. Assign appropriate permissions to each role

### Adding New Permissions

1. Edit `nexora-api/packages/database/prisma/seed-rbac.js`
2. Add your permission to the `PERMISSIONS` array:

```javascript
{
  code: 'module:action:operation',
  name: 'Human Readable Name',
  module: 'ModuleName',
  description: 'Description of what this allows',
}
```

3. Run the setup script again

---

## 🧪 Testing RBAC

### Testing with Different Roles

```bash
# Login as different users
curl -X POST http://localhost:4000/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "admin@example.com", "password": "password"}'

# Use the token in subsequent requests
curl -X GET http://localhost:4000/api/v1/crm/contacts \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Checking User Permissions

```bash
# Get current user info (includes permissions)
curl -X GET http://localhost:4000/api/v1/auth/me \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🔒 Security Best Practices

1. **Always use `authenticate` middleware** on protected routes
2. **Use specific permissions** rather than wildcards when possible
3. **Check permissions at the route level** (middleware) AND in business logic if needed
4. **Don't grant `*` permission** to regular users - only Super Admins
5. **Audit role assignments** regularly
6. **Use system roles** (Super Admin, Admin, Manager, etc.) as templates
7. **Create custom roles** for specific use cases
8. **Test permission changes** thoroughly before deploying

---

## 📊 RBAC Status

✅ **55 permissions** created
✅ **7 default roles** configured
✅ **8 tenants** enabled with RBAC
✅ **Authentication middleware** active
✅ **Authorization middleware** available
✅ **All CRM routes** protected

---

## 🚀 Next Steps

1. **Assign roles to users** via admin interface
2. **Test different roles** to ensure proper access control
3. **Create custom roles** as needed for your organization
4. **Monitor and audit** permission usage
5. **Update documentation** when adding new permissions

---

For more information or issues, refer to the authentication middleware code or contact the development team.
