using ClaimShield.Api.Authentication;
using ClaimShield.Api.Constants;
using ClaimShield.Api.Interfaces.Services;
using ClaimShield.Api.Models.DTOs.ClaimDocuments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClaimShield.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ClaimDocumentsController : ControllerBase
    {
        private readonly IClaimDocumentService _claimDocumentService;
        private readonly ICurrentUserService _currentUserService;

        public ClaimDocumentsController(
            IClaimDocumentService claimDocumentService,
            ICurrentUserService currentUserService)
        {
            _claimDocumentService = claimDocumentService;
            _currentUserService = currentUserService;
        }

        // =========================================================
        // ACCESS HELPERS
        // =========================================================

        private bool IsAdmin =>
            string.Equals(
                _currentUserService.RoleName,
                RoleConstants.Admin,
                StringComparison.OrdinalIgnoreCase);

        private int CurrentRoleId =>
            _currentUserService.RoleName switch
            {
                RoleConstants.Customer => RoleConstants.CustomerId,
                RoleConstants.Repairer => RoleConstants.RepairerId,
                RoleConstants.Surveyor => RoleConstants.SurveyorId,
                RoleConstants.Approver => RoleConstants.ApproverId,
                RoleConstants.Admin => RoleConstants.AdminId,
                _ => 0
            };

        private static IActionResult Forbidden(
            string message)
        {
            return new ObjectResult(new
            {
                Success = false,
                Message = message
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }

        // =========================================================
        // GET ALL CLAIM DOCUMENTS
        // GET: api/ClaimDocuments
        // =========================================================

        [HttpGet]
        [ProducesResponseType(
            typeof(IEnumerable<ClaimDocumentResponseDto>),
            StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetAll()
        {
            if (!IsAdmin)
            {
                return Forbidden(
                    "Only an Admin can list all claim documents.");
            }

            var documents =
                await _claimDocumentService.GetAllAsync();

            return Ok(documents);
        }

        // =========================================================
        // GET DOCUMENT BY ID
        // GET: api/ClaimDocuments/{id}
        // =========================================================

        [HttpGet("{id:guid}")]
        [ProducesResponseType(
            typeof(ClaimDocumentResponseDto),
            StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetById(Guid id)
        {
            var document =
                await _claimDocumentService.GetByIdAsync(id);

            if (document == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Claim document not found."
                });
            }

            if (!_currentUserService.UserId.HasValue ||
                !await _claimDocumentService.CanUserAccessClaimAsync(
                    document.ClaimId,
                    _currentUserService.UserId.Value,
                    CurrentRoleId))
            {
                return Forbidden(
                    "You are not authorized to view this document.");
            }

            return Ok(document);
        }

        // =========================================================
        // GET DOCUMENTS BY CLAIM
        // GET: api/ClaimDocuments/claim/{claimId}
        // =========================================================

        [HttpGet("claim/{claimId:guid}")]
        [ProducesResponseType(
            typeof(IEnumerable<ClaimDocumentResponseDto>),
            StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetByClaim(
            Guid claimId)
        {
            if (!_currentUserService.UserId.HasValue ||
                !await _claimDocumentService.CanUserAccessClaimAsync(
                    claimId,
                    _currentUserService.UserId.Value,
                    CurrentRoleId))
            {
                return Forbidden(
                    "You are not authorized to view documents for this claim.");
            }

            var documents =
                await _claimDocumentService.GetByClaimAsync(
                    claimId);

            return Ok(documents);
        }

        // =========================================================
        // UPLOAD A DOCUMENT
        // POST: api/ClaimDocuments/upload
        // =========================================================

        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(58720256)]
        [ProducesResponseType(
            typeof(ClaimDocumentResponseDto),
            StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Upload(
            [FromForm] Guid claimId,
            [FromForm] int documentTypeId,
            [FromForm] IFormFile file)
        {
            if (!_currentUserService.UserId.HasValue)
            {
                return Forbidden(
                    "Unable to determine the logged-in user.");
            }

            if (!await _claimDocumentService.CanUserAccessClaimAsync(
                    claimId,
                    _currentUserService.UserId.Value,
                    CurrentRoleId))
            {
                return Forbidden(
                    "You are not authorized to upload documents for this claim.");
            }

            var (success, error, document) =
                await _claimDocumentService.UploadAsync(
                    claimId,
                    documentTypeId,
                    _currentUserService.UserId.Value,
                    file);

            if (!success)
            {
                return BadRequest(new
                {
                    Success = false,
                    Message = error
                });
            }

            return CreatedAtAction(
                nameof(GetById),
                new
                {
                    id = document!.ClaimDocumentId
                },
                document);
        }

        // =========================================================
        // GET A SHORT-LIVED DOWNLOAD URL
        // GET: api/ClaimDocuments/{id}/download-url
        // =========================================================

        [HttpGet("{id:guid}/download-url")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetDownloadUrl(
            Guid id)
        {
            var document =
                await _claimDocumentService.GetByIdAsync(id);

            if (document == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Claim document not found."
                });
            }

            if (!_currentUserService.UserId.HasValue ||
                !await _claimDocumentService.CanUserAccessClaimAsync(
                    document.ClaimId,
                    _currentUserService.UserId.Value,
                    CurrentRoleId))
            {
                return Forbidden(
                    "You are not authorized to download this document.");
            }

            var url =
                await _claimDocumentService.GetDownloadUrlAsync(id);

            return Ok(new
            {
                Url = url,
                ExpiresInSeconds = 300
            });
        }

        // =========================================================
        // OCR PREVIEW FOR A SINGLE DOCUMENT
        // GET: api/ClaimDocuments/{id}/ocr-preview
        // =========================================================
        //
        // Lets the customer see what the OCR engine read off a
        // Number Plate / RC / DL photo right after uploading it,
        // without waiting for the full Step 2 cross-check.
        // =========================================================

        [HttpGet("{id:guid}/ocr-preview")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetOcrPreview(Guid id)
        {
            var document =
                await _claimDocumentService.GetByIdAsync(id);

            if (document == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Claim document not found."
                });
            }

            if (!_currentUserService.UserId.HasValue ||
                !await _claimDocumentService.CanUserAccessClaimAsync(
                    document.ClaimId,
                    _currentUserService.UserId.Value,
                    CurrentRoleId))
            {
                return Forbidden(
                    "You are not authorized to view this document.");
            }

            var result =
                await _claimDocumentService.GetOcrPreviewAsync(id);

            if (result == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Claim document not found."
                });
            }

            return Ok(result);
        }

        // =========================================================
        // CREATE CLAIM DOCUMENT (raw metadata - Admin backfill only)
        // POST: api/ClaimDocuments
        // =========================================================

        [HttpPost]
        [ProducesResponseType(
            typeof(ClaimDocumentResponseDto),
            StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Create(
            CreateClaimDocumentRequest request)
        {
            if (!IsAdmin)
            {
                return Forbidden(
                    "Only an Admin can register document metadata directly. " +
                    "Use POST api/ClaimDocuments/upload to upload a file.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var document =
                await _claimDocumentService.CreateAsync(
                    request);

            return CreatedAtAction(
                nameof(GetById),
                new
                {
                    id = document.ClaimDocumentId
                },
                document);
        }

        // =========================================================
        // UPDATE CLAIM DOCUMENT (raw metadata - Admin only)
        // PUT: api/ClaimDocuments/{id}
        // =========================================================

        [HttpPut("{id:guid}")]
        [ProducesResponseType(
            StatusCodes.Status200OK)]
        [ProducesResponseType(
            StatusCodes.Status400BadRequest)]
        [ProducesResponseType(
            StatusCodes.Status404NotFound)]
        [ProducesResponseType(
            StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Update(
            Guid id,
            CreateClaimDocumentRequest request)
        {
            if (!IsAdmin)
            {
                return Forbidden(
                    "Only an Admin can edit document metadata directly.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var updated =
                await _claimDocumentService.UpdateAsync(
                    id,
                    request);

            if (!updated)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Claim document not found."
                });
            }

            return Ok(new
            {
                Success = true,
                Message =
                    "Claim document updated successfully."
            });
        }

        // =========================================================
        // DELETE CLAIM DOCUMENT
        // DELETE: api/ClaimDocuments/{id}
        // =========================================================

        [HttpDelete("{id:guid}")]
        [ProducesResponseType(
            StatusCodes.Status200OK)]
        [ProducesResponseType(
            StatusCodes.Status404NotFound)]
        [ProducesResponseType(
            StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> Delete(Guid id)
        {
            var document =
                await _claimDocumentService.GetByIdAsync(id);

            if (document == null)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Claim document not found."
                });
            }

            if (!IsAdmin &&
                document.UploadedBy != _currentUserService.UserId)
            {
                return Forbidden(
                    "You are not authorized to delete this document.");
            }

            var deleted =
                await _claimDocumentService.DeleteAsync(id);

            if (!deleted)
            {
                return NotFound(new
                {
                    Success = false,
                    Message = "Claim document not found."
                });
            }

            return Ok(new
            {
                Success = true,
                Message = "Claim document deleted successfully."
            });
        }
    }
}