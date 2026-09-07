using ClaimShield.Api.Data.Context;
using ClaimShield.Api.Interfaces.Repositories;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.Customers;
using ClaimShield.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClaimShield.Api.Services
{
    public class CustomerService : ICustomerService
    {
        private readonly ICustomerRepository _customerRepository;
        private readonly ClaimShieldDbContext _context;

        public CustomerService(
            ICustomerRepository customerRepository,
            ClaimShieldDbContext context)
        {
            _customerRepository = customerRepository;
            _context = context;
        }

        // =========================================================
        // GET ALL CUSTOMERS
        // =========================================================

        public async Task<IEnumerable<CustomerResponseDto>>
            GetAllCustomersAsync()
        {
            var customers =
                await _customerRepository.GetAllAsync();

            var customerList = customers.ToList();
            var names = await GetDisplayNamesAsync(customerList.Select(c => c.UserId));

            return customerList.Select(c => new CustomerResponseDto
            {
                CustomerId =
                    c.CustomerId,

                UserId =
                    c.UserId,

                CustomerCode =
                    c.CustomerCode,

                DateOfBirth =
                    c.DateOfBirth,

                Gender =
                    c.Gender,

                AadhaarNumber =
                    c.AadhaarNumber,

                DrivingLicenseNumber =
                    c.DrivingLicenseNumber,

                AddressLine1 =
                    c.AddressLine1,

                AddressLine2 =
                    c.AddressLine2,

                City =
                    c.City,

                State =
                    c.State,

                Pincode =
                    c.Pincode,

                CustomerName =
                    names.GetValueOrDefault(c.UserId)
            });
        }

        // =========================================================
        // GET CUSTOMER BY ID
        // =========================================================

        public async Task<CustomerResponseDto?>
            GetCustomerByIdAsync(
                Guid customerId)
        {
            var customer =
                await _customerRepository.GetByIdAsync(
                    customerId);

            if (customer == null)
            {
                return null;
            }

            return await MapToResponseDtoAsync(customer);
        }

        // =========================================================
        // GET CUSTOMER BY USER ID
        // =========================================================

        public async Task<CustomerResponseDto?>
            GetCustomerByUserIdAsync(
                Guid userId)
        {
            var customer =
                await _customerRepository.GetByUserIdAsync(
                    userId);

            if (customer == null)
            {
                return null;
            }

            return await MapToResponseDtoAsync(customer);
        }

        // =========================================================
        // CREATE CUSTOMER
        // =========================================================

        public async Task<CustomerResponseDto>
            CreateCustomerAsync(
                CreateCustomerRequest request)
        {
            var customer = new Customer
            {
                CustomerId =
                    Guid.NewGuid(),

                UserId =
                    request.UserId,

                CustomerCode =
                    request.CustomerCode,

                DateOfBirth =
                    request.DateOfBirth,

                Gender =
                    request.Gender,

                AadhaarNumber =
                    request.AadhaarNumber,

                DrivingLicenseNumber =
                    request.DrivingLicenseNumber,

                AddressLine1 =
                    request.AddressLine1,

                AddressLine2 =
                    request.AddressLine2,

                City =
                    request.City,

                State =
                    request.State,

                Pincode =
                    request.Pincode,

                CreatedDate =
                    DateTime.UtcNow
            };

            await _customerRepository.AddAsync(
                customer);

            // -----------------------------------------------------
            // The customer was just inserted using the generated ID.
            // Retrieve it again so the response is consistent with
            // the GET-BY-ID mapping.
            // -----------------------------------------------------

            var createdCustomer =
                await _customerRepository.GetByIdAsync(
                    customer.CustomerId);

            if (createdCustomer == null)
            {
                throw new InvalidOperationException(
                    "Customer was created but could not be retrieved.");
            }

            return await MapToResponseDtoAsync(
                createdCustomer);
        }

        // =========================================================
        // UPDATE CUSTOMER
        // =========================================================

        public async Task<bool>
            UpdateCustomerAsync(
                UpdateCustomerRequest request)
        {
            var customer =
                await _customerRepository.GetByIdAsync(
                    request.CustomerId);

            if (customer == null)
            {
                return false;
            }

            customer.UserId =
                request.UserId;

            customer.CustomerCode =
                request.CustomerCode;

            customer.DateOfBirth =
                request.DateOfBirth;

            customer.Gender =
                request.Gender;

            customer.AadhaarNumber =
                request.AadhaarNumber;

            customer.DrivingLicenseNumber =
                request.DrivingLicenseNumber;

            customer.AddressLine1 =
                request.AddressLine1;

            customer.AddressLine2 =
                request.AddressLine2;

            customer.City =
                request.City;

            customer.State =
                request.State;

            customer.Pincode =
                request.Pincode;

            customer.UpdatedDate =
                DateTime.UtcNow;

            await _customerRepository.UpdateAsync(
                customer);

            return true;
        }

        // =========================================================
        // DELETE CUSTOMER
        // =========================================================

        public async Task<bool>
            DeleteCustomerAsync(
                Guid customerId)
        {
            var customer =
                await _customerRepository.GetByIdAsync(
                    customerId);

            if (customer == null)
            {
                return false;
            }

            await _customerRepository.DeleteAsync(
                customerId);

            return true;
        }

        // =========================================================
        // MAP CUSTOMER TO DTO (single) - resolves the name too, so
        // the shape is identical whether one customer or all of them
        // are requested.
        // =========================================================

        private async Task<CustomerResponseDto> MapToResponseDtoAsync(
            Customer customer)
        {
            var names = await GetDisplayNamesAsync(new[] { customer.UserId });

            return new CustomerResponseDto
            {
                CustomerId =
                    customer.CustomerId,

                UserId =
                    customer.UserId,

                CustomerCode =
                    customer.CustomerCode,

                DateOfBirth =
                    customer.DateOfBirth,

                Gender =
                    customer.Gender,

                AadhaarNumber =
                    customer.AadhaarNumber,

                DrivingLicenseNumber =
                    customer.DrivingLicenseNumber,

                AddressLine1 =
                    customer.AddressLine1,

                AddressLine2 =
                    customer.AddressLine2,

                City =
                    customer.City,

                State =
                    customer.State,

                Pincode =
                    customer.Pincode,

                CustomerName =
                    names.GetValueOrDefault(customer.UserId)
            };
        }

        // Checkpoint 9 - batched name resolution (one query for however
        // many customers are being mapped, never one query per row),
        // same FirstName+LastName convention used elsewhere in this
        // codebase (e.g. ClaimsHandlerDashboardService,
        // ClaimDecisionService's GetUserDisplayName).
        private async Task<Dictionary<Guid, string>> GetDisplayNamesAsync(
            IEnumerable<Guid> userIds)
        {
            var ids = userIds.Distinct().ToList();

            var users =
                await _context.Users
                    .Where(u => ids.Contains(u.UserId))
                    .ToListAsync();

            return users.ToDictionary(
                u => u.UserId,
                u =>
                {
                    var full = $"{u.FirstName} {u.LastName}".Trim();
                    return string.IsNullOrEmpty(full) ? "Unknown" : full;
                });
        }
    }
}